// @ts-check
// @meddleware/eslint-config — flat-config fragments that keep apps on the right side of the chain-access
// boundary (workspace ADR-0001): apps call domain clients (access-gate-client, sealed-storage-client,
// walrus-storage-client, token-issuance-client, the wallet-adapter); they never build transactions or read chain
// objects themselves. Plus a template rule that keeps URL bindings on native elements sanitised.
//
// The rules catch accidents and shortcuts, not determined evasion: a name-based selector cannot follow a
// value through an arbitrary re-export or helper. Consumers already register the `@typescript-eslint` and
// `vue` plugins (e.g. through `@vue/eslint-config-typescript` and `eslint-plugin-vue`); this package
// declares no plugins and has no runtime dependencies.
//
// Main export: `suiBoundary(options)`, the flat-config objects a consumer appends last. Its building blocks are exported
// too (the option and selector lists, `templateUrlRestrictions`, `splitGlobs`, `vueGlobs`). Most apps take it through
// `@meddleware/frontend-config/eslint` (`vueApp({ sui: true })`). Tests: tests/boundary.test.ts.

/** Helpers whose return value is a safe URL (or undefined) for a native element binding. */
export const URL_HELPERS = Object.freeze(['safeHref', 'safeIcon', 'safePath', 'suiExplorerUrl', 'walruscanBlobUrl'])

/** Native-element attributes that load or navigate to a URL. */
export const URL_ATTRIBUTES = Object.freeze([
  'href', 'src', 'srcset', 'action', 'formaction', 'poster', 'data', 'xlink:href', 'ping', 'imagesrcset',
])

/** Bound attributes that are refused outright on native elements: they take markup, not a URL. */
export const REFUSED_ATTRIBUTES = Object.freeze(['srcdoc'])

/** `@mysten/sui` subpaths an app may import at runtime (everything else is chain access or tooling). */
export const ALLOWED_SUI_SUBPATHS = Object.freeze(['utils', 'bcs'])

/** Native tags matched case-insensitively (Vue resolves `<IMG>` as a component but the DOM builds an `img`). */
const NATIVE_TAGS = [
  'a', 'area', 'audio', 'base', 'button', 'embed', 'form', 'frame', 'iframe', 'image', 'img', 'input', 'link',
  'meta', 'object', 'script', 'source', 'svg', 'track', 'use', 'video',
]
/**
 * Selector for a native element: any lower-case tag (Vue treats it as HTML) or a known native tag in any case. A capitalised
 * or hyphenated name is a component, which sanitises its own props.
 */
const NATIVE = `:matches(VElement[rawName=/^[a-z][a-z0-9]*$/], VElement[rawName=/^(${NATIVE_TAGS.join('|')})$/i])`

/** The allowed subpaths as a regular-expression alternation. */
const allowedSui = ALLOWED_SUI_SUBPATHS.join('|')
/**
 * Selector-attribute regex for an import source that is chain access: an `@mysten/sui/` subpath other than the allowed ones.
 * Used by the `import()` and `require()` entries, which the import rules do not see.
 */
const SUI_RESTRICTED_SOURCE = `/^@mysten\\/sui\\/(?!(${allowedSui})$)/`

/**
 * The message for a refused import, naming the path pattern it matched.
 * @param {string} name - the restricted path or pattern
 * @returns {string} the message shown by ESLint
 */
const restrictedImportMessage = (name) =>
  `No chain access in app code: use the domain client or the wallet-adapter (type-only imports of ${name} are fine).`

/**
 * `@typescript-eslint/no-restricted-imports` options: any `@mysten/sui/*` subpath except the allowed ones
 * (type-only imports stay allowed); JSON-RPC never.
 */
export const restrictedImportOptions = Object.freeze({
  // Frozen throughout so a consumer cannot change the boundary for every other config object by mutating the export.
  paths: Object.freeze([
    Object.freeze({
      name: '@mysten/sui/jsonRpc',
      message: 'Public fullnodes have dropped JSON-RPC; use the domain client (gRPC).',
    }),
  ]),
  patterns: Object.freeze([
    Object.freeze({
      // jsonRpc is excluded here so the `paths` entry above refuses it even as a type import (a matching
      // pattern with allowTypeImports would let the type import through).
      group: Object.freeze(['@mysten/sui/*', '!@mysten/sui/jsonRpc', ...ALLOWED_SUI_SUBPATHS.map((s) => `!@mysten/sui/${s}`)]),
      allowTypeImports: true,
      message: restrictedImportMessage('@mysten/sui/*'),
    }),
  ]),
})

/**
 * Method names that are specific to building Sui transactions: ANY reference is refused (a call, `.bind`,
 * destructuring, computed access).
 */
const COMMANDS = ['moveCall', 'splitCoins', 'mergeCoins', 'transferObjects', 'makeMoveVec']
/** Generic names, refused only as calls (they are common outside Sui: `bus.publish(...)`). */
const GENERIC_COMMANDS = ['publish', 'upgrade']
/**
 * Chain reads, refused as calls. Balance and epoch reads (`getBalance`, `listBalances`,
 * `getCurrentSystemState`) are deliberately allowed: they are typed, domain-free queries (ADR-0001 note).
 */
const READS = [
  'getObject', 'getObjects', 'listOwnedObjects', 'getOwnedObjects', 'listEvents', 'queryEvents', 'listCoins',
  'listDynamicFields', 'getDynamicField', 'getTransaction', 'simulateTransaction', 'executeTransaction',
]
/**
 * Names as a regular-expression alternation, for a selector attribute.
 * @param {string[]} names - plain identifiers (no regular-expression characters)
 * @returns {string} `a|b|c`
 */
const anyOf = (names) => names.join('|')

/** The message for a refused dynamic import or `require()`. */
const IMPORT_MESSAGE = 'No chain access in app code: use the domain client or the wallet-adapter.'

/** `no-restricted-syntax` entries about importing (dynamic `import()` / `require`) the restricted paths. */
const importSyntax = [
  // A literal source: `import('@mysten/sui/grpc')`.
  { selector: `ImportExpression[source.value=${SUI_RESTRICTED_SOURCE}]`, message: IMPORT_MESSAGE },
  // A template or a concatenation cannot be resolved statically, so any one that starts with the scope is refused.
  { selector: "ImportExpression[source.type='TemplateLiteral'][source.quasis.0.value.raw=/@mysten\\//]", message: IMPORT_MESSAGE },
  { selector: "ImportExpression[source.type='BinaryExpression'][source.left.value=/@mysten\\//]", message: IMPORT_MESSAGE },
  // CommonJS `require()` of a restricted path, for the plain JavaScript files.
  { selector: `CallExpression[callee.name='require'][arguments.0.value=${SUI_RESTRICTED_SOURCE}]`, message: IMPORT_MESSAGE },
]

/** `no-restricted-syntax` entries about building transactions and reading chain objects. */
const chainSyntax = [
  // The transaction builder itself, by construction or through its statics.
  { selector: "NewExpression[callee.name='Transaction']", message: 'Build transactions in the domain client, not in app code.' },
  { selector: "MemberExpression[object.name='Transaction']", message: 'Build transactions in the domain client, not in app code (`Transaction.from` and the other statics included).' },
  // Commands by any reference: a member, a computed name, or destructuring.
  { selector: `MemberExpression[property.name=/^(${anyOf(COMMANDS)})$/]`, message: 'Transaction commands belong in the domain client (extend it instead).' },
  { selector: `MemberExpression[computed=true][property.value=/^(${anyOf([...COMMANDS, ...GENERIC_COMMANDS, ...READS])})$/]`, message: 'Chain access by computed property name is refused too: use the domain client.' },
  { selector: `ObjectPattern > Property[key.name=/^(${anyOf(COMMANDS)})$/]`, message: 'Transaction commands belong in the domain client (destructuring them does not change that).' },
  // Generic command names and reads, as calls only.
  { selector: `CallExpression[callee.property.name=/^(${anyOf(GENERIC_COMMANDS)})$/]`, message: 'Transaction commands belong in the domain client (extend it instead).' },
  { selector: `CallExpression[callee.property.name=/^(${anyOf(READS)})$/]`, message: 'Chain reads belong in the domain client (it pages, type-checks and validates).' },
]

/** `no-restricted-syntax` entries for script code in app files. */
export const scriptRestrictions = Object.freeze([...chainSyntax, ...importSyntax].map((r) => Object.freeze(r)))

/** The same without the import entries — for the wallet shim, which may import the client but nothing else. */
export const walletRestrictions = Object.freeze(chainSyntax.map((r) => Object.freeze(r)))

/**
 * Escape a helper name for use inside a selector regular expression.
 * @param {string} name - a helper name from the consumer
 * @returns {string} the name with anything but identifier characters removed and `$` escaped (empty if nothing is left)
 */
function escapeName(name) {
  // Characters an identifier cannot hold are dropped, not escaped: such a name could never match a call anyway.
  return name.replace(/[^A-Za-z0-9_$]/g, '').replace(/\$/g, '\\$')
}

/**
 * `vue/no-restricted-syntax` entries: a URL attribute bound on a native element must be a literal or
 * the result of a URL helper (or a ternary of those). Dynamic attribute names, argument-less `v-bind`
 * and bound `srcdoc` / `<meta content>` / `url(...)` in a bound `style` are refused. Components are
 * exempt — a component sanitises its own props.
 *
 * Helper trust is by name: a locally defined `safeHref = (u) => u` satisfies the rule.
 *
 * @param {readonly string[]} [urlHelpers] helper names that return a safe URL (defaults to URL_HELPERS)
 * @returns {{ selector: string, message: string }[]}
 */
export function templateUrlRestrictions(urlHelpers = URL_HELPERS) {
  const helpers = urlHelpers.map(escapeName).filter(Boolean).join('|')
  const attrs = URL_ATTRIBUTES.join('|')
  // A safe expression: a literal, a template with no substitutions, `undefined`, or a call to a trusted helper.
  const safe = `Literal, TemplateLiteral[expressions.length=0], Identifier[name='undefined'], CallExpression[callee.name=/^(${helpers})$/]`
  // A ternary is safe when neither branch is unsafe (written as a double negative, which esquery can express).
  const safeOrTernaryOfSafe =
    `${safe}, ConditionalExpression:not(:has(> .consequent:not(${safe}))):not(:has(> .alternate:not(${safe})))`
  // `:x` and `v-bind:x` are the same directive in the AST.
  const bind = "VAttribute[directive=true][key.name.name='bind']"
  const message = `Bind URLs on native elements through ${urlHelpers.join(', ')} (or a literal).`
  return [
    // A bound URL attribute whose expression is not safe.
    {
      selector:
        `${NATIVE} > VStartTag > ${bind}[key.argument.name=/^(${attrs})$/] > ` +
        `VExpressionContainer > .expression:not(:matches(${safeOrTernaryOfSafe}))`,
      message,
    },
    {
      selector: `${NATIVE} > VStartTag > ${bind}[key.argument.name=/^(${REFUSED_ATTRIBUTES.join('|')})$/]`,
      message: 'Never bind markup (srcdoc) on a native element.',
    },
    {
      selector: `VElement[rawName=/^meta$/i] > VStartTag > ${bind}[key.argument.name='content']`,
      message: 'Never bind <meta content> (it can carry http-equiv="refresh" redirects).',
    },
    {
      selector: `${NATIVE} > VStartTag > ${bind}:not([key.argument])`,
      message: 'Bind attributes one by one on native elements: v-bind="object" cannot be checked for URL sinks.',
    },
    {
      selector: `${NATIVE} > VStartTag > ${bind}[key.argument.type='VExpressionContainer']`,
      message: 'A dynamic attribute name (:[name]) cannot be checked for URL sinks on a native element.',
    },
    {
      selector: `${NATIVE} > VStartTag > ${bind}[key.argument.name='style'] :matches(TemplateElement[value.raw=/url\\(/i], Literal[value=/url\\(/i])`,
      message: 'Do not build url(...) in a bound style: it loads whatever the value says. Use a class or a sanitised property.',
    },
  ]
}

/**
 * The `.vue` globs implied by script globs: `src/**​/*.{ts,vue}` → `src/**​/*.vue`; entries that cannot
 * match a `.vue` file are dropped, so the template rule never reaches files the `vue` plugin is not set up for.
 *
 * @param {string[]} files
 * @returns {string[]}
 */
export function vueGlobs(files) {
  /** @type {string[]} */
  const out = []
  for (const f of files) {
    // Only a trailing brace list (`*.{ts,vue}`) or a plain `.vue` suffix is understood; other globs are left out.
    const braces = f.match(/^(.*)\.\{([^}]*)\}$/)
    if (braces) {
      if (braces[2].split(',').map((e) => e.trim()).includes('vue')) out.push(`${braces[1]}.vue`)
    } else if (f.endsWith('.vue')) out.push(f)
  }
  // Two script globs can imply the same .vue glob.
  return [...new Set(out)]
}

/** Extensions parsed by the TypeScript parser (directly, or inside a Vue single-file component's script). */
const TS_EXTENSIONS = ['ts', 'mts', 'cts', 'tsx', 'vue']
/** Extensions parsed as plain JavaScript. */
const JS_EXTENSIONS = ['js', 'mjs', 'cjs', 'jsx']

/**
 * Split script globs by the kind of parser setup they need: TypeScript and Vue files take the
 * `@typescript-eslint` import rule (which understands type-only imports); plain JavaScript files take the
 * core `no-restricted-imports`, so the plugin need not be registered for them.
 *
 * @param {string[]} files
 * @returns {{ ts: string[], js: string[] }}
 */
export function splitGlobs(files) {
  /** @type {string[]} */
  const ts = []
  /** @type {string[]} */
  const js = []
  for (const f of files) {
    // `base` is the glob without its extension part; `exts` the extensions it names.
    const braces = f.match(/^(.*)\.\{([^}]*)\}$/)
    const base = braces ? braces[1] : f.replace(/\.[A-Za-z]+$/, '')
    const exts = braces ? braces[2].split(',').map((e) => e.trim()) : [f.slice(base.length + 1)]
    const pick = (/** @type {string[]} */ list) => exts.filter((e) => list.includes(e))
    const t = pick(TS_EXTENSIONS)
    const j = pick(JS_EXTENSIONS)
    const glob = (/** @type {string[]} */ list) => `${base}.${list.length === 1 ? list[0] : `{${list.join(',')}}`}`
    // One glob may yield both kinds: `*.{ts,js}` becomes `*.ts` and `*.js`.
    if (t.length) ts.push(glob(t))
    if (j.length) js.push(glob(j))
  }
  return { ts, js }
}

/**
 * @typedef {string | { selector: string, message?: string }} SyntaxRestriction
 * @typedef {string | { name: string, message?: string, allowTypeImports?: boolean }} ImportPath
 *
 * @typedef {object} SuiBoundaryOptions
 * @property {string[]} [files] files the boundary applies to (default: app `src/`, every JS/TS/Vue extension)
 * @property {string[]} [vueFiles] files the template rule applies to (default: the `.vue` globs implied by `files`)
 * @property {string[]} [ignores] files exempt (default: tests)
 * @property {string[]} [walletFiles] the wallet shim(s): may import the client, but commands and reads stay refused (default `src/wallet.ts`)
 * @property {string[]} [urlHelpers] extra URL helpers this repo provides
 * @property {SyntaxRestriction[]} [extraSyntax] your own `no-restricted-syntax` entries, kept in force next to the boundary's
 * @property {SyntaxRestriction[]} [extraTemplateSyntax] your own `vue/no-restricted-syntax` entries, kept next to the boundary's
 * @property {ImportPath[]} [extraImportPaths] your own restricted import paths, merged into the TypeScript rule
 */

/**
 * The boundary as flat-config objects. Append it **last** in `eslint.config.ts`.
 *
 * ESLint does not merge rule options across config objects: for the files it covers, this fragment's
 * `no-restricted-syntax`, `vue/no-restricted-syntax` and `@typescript-eslint/no-restricted-imports`
 * options REPLACE the consumer's own. Pass your own restrictions through `extraSyntax`,
 * `extraTemplateSyntax` and `extraImportPaths` so they stay in force. The core `no-restricted-imports`
 * is switched off for these files (the TypeScript rule supersedes it).
 *
 * @param {SuiBoundaryOptions} [options]
 * @returns {import('eslint').Linter.Config[]}
 */
export function suiBoundary(options = {}) {
  // Defaults: app source only, every script extension; tests and files outside src/ are not app code.
  const files = options.files ?? ['src/**/*.{ts,mts,cts,tsx,js,mjs,cjs,jsx,vue}']
  const { ts: tsFiles, js: jsFiles } = splitGlobs(files)
  const vueFiles = options.vueFiles ?? vueGlobs(files)
  const testFiles = ['**/*.{test,spec}.{ts,mts,cts,tsx,js,mjs,cjs,jsx}', '**/__tests__/**']
  const walletFiles = options.walletFiles ?? ['src/wallet.ts']
  const ignores = options.ignores ?? testFiles
  const extraSyntax = options.extraSyntax ?? []
  const importPaths = options.extraImportPaths ?? []

  /** @type {import('eslint').Linter.Config[]} */
  const configs = [
    // TypeScript and Vue: the typescript-eslint import rule, which understands `import type`.
    {
      name: '@meddleware/eslint-config/sui-boundary',
      files: tsFiles,
      ignores: [...ignores, ...walletFiles],
      rules: {
        'no-restricted-imports': 'off',
        '@typescript-eslint/no-restricted-imports': [
          'error',
          { paths: [...restrictedImportOptions.paths, ...importPaths], patterns: [...restrictedImportOptions.patterns] },
        ],
        'no-restricted-syntax': ['error', ...scriptRestrictions, ...extraSyntax],
      },
    },
  ]
  if (jsFiles.length) {
    // Plain JavaScript: the core import rule (no type-only imports to allow), no plugin required.
    configs.push({
      name: '@meddleware/eslint-config/sui-boundary-js',
      files: jsFiles,
      ignores,
      rules: {
        'no-restricted-imports': [
          'error',
          {
            paths: [...restrictedImportOptions.paths, ...importPaths],
            patterns: restrictedImportOptions.patterns.map(({ group, message }) => ({ group: [...group], message })),
          },
        ],
        'no-restricted-syntax': ['error', ...scriptRestrictions, ...extraSyntax],
      },
    })
  }
  if (walletFiles.length) {
    // The wallet shim: the client import is allowed (no `patterns`), but JSON-RPC, commands, reads and transactions are not.
    configs.push({
      name: '@meddleware/eslint-config/sui-boundary-wallet',
      files: walletFiles,
      ignores,
      rules: {
        'no-restricted-imports': 'off',
        '@typescript-eslint/no-restricted-imports': ['error', { paths: [...restrictedImportOptions.paths, ...importPaths] }],
        'no-restricted-syntax': ['error', ...walletRestrictions, ...extraSyntax],
      },
    })
  }
  if (vueFiles.length) {
    // Templates: the URL-binding rules, and no `v-html` (it renders markup unsanitised).
    configs.push({
      name: '@meddleware/eslint-config/template-urls',
      files: vueFiles,
      ignores,
      rules: {
        'vue/no-restricted-syntax': [
          'error',
          ...templateUrlRestrictions([...URL_HELPERS, ...(options.urlHelpers ?? [])]),
          ...(options.extraTemplateSyntax ?? []),
        ],
        'vue/no-v-html': 'error',
      },
    })
  }
  return configs
}

/**
 * The documentation rule of the workspace documentation standard (D144): every function, method and class has a doc comment, and
 * with `params: true` the comment also names every parameter and return value. The plugin is passed in, not imported, so this
 * package keeps no runtime dependency: a consumer imports `eslint-plugin-jsdoc` itself and hands it over.
 * @param {object} options - the settings
 * @param {object} options.plugin - the default export of `eslint-plugin-jsdoc`
 * @param {boolean} [options.params] - also require `@param` and `@returns` tags (off by default: the standard asks for them on exported items)
 * @param {string[]} [options.files] - the files the rule applies to (default: the sources, not the tests)
 * @param {string[]} [options.ignores] - files exempt from it (default: test files and declaration files)
 * @returns {import('eslint').Linter.Config[]} flat-config objects to append to a consumer's configuration
 */
export function docsRules(options) {
  const { plugin, params = false } = options
  if (!plugin) throw new Error('docsRules({ plugin }): pass the default export of eslint-plugin-jsdoc')
  const files = options.files ?? ['src/**/*.{ts,mts,cts,tsx,js,mjs,cjs,jsx,vue}']
  const ignores = options.ignores ?? ['**/*.test.*', '**/*.spec.*', '**/__tests__/**', '**/*.d.ts']
  return [
    {
      name: '@meddleware/eslint-config/docs',
      files,
      ignores,
      plugins: { jsdoc: plugin },
      rules: {
        // A TSDoc comment on every declaration that is a function, method or class (private ones included).
        'jsdoc/require-jsdoc': [
          'error',
          {
            publicOnly: false,
            require: { FunctionDeclaration: true, MethodDefinition: true, ClassDeclaration: true, ArrowFunctionExpression: false, FunctionExpression: false },
            contexts: ['TSInterfaceDeclaration', 'TSTypeAliasDeclaration', 'TSEnumDeclaration'],
          },
        ],
        // The parameter and return tags, only when asked for.
        'jsdoc/require-param': params ? ['error'] : 'off',
        'jsdoc/require-returns': params ? ['error'] : 'off',
      },
    },
  ]
}
