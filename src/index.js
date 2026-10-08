// @ts-check
// @meddleware/eslint-config — flat-config fragments that keep apps on the right side of the chain-access
// boundary (workspace ADR-0001): apps call domain clients (access-gate-client, seal-client,
// walrus-client, sui-token-client, the wallet-adapter); they never build transactions or read chain
// objects themselves. Plus a template rule that keeps URL bindings on native elements sanitised.
//
// The rules catch accidents and shortcuts, not determined evasion: a name-based selector cannot follow a
// value through an arbitrary re-export or helper. Consumers already register the `@typescript-eslint` and
// `vue` plugins (e.g. through `@vue/eslint-config-typescript` and `eslint-plugin-vue`); this package
// declares no plugins and has no runtime dependencies.

/** Helpers whose return value is a safe URL (or undefined) for a native element binding. */
export const URL_HELPERS = Object.freeze(['safeHref', 'safeIcon', 'suiExplorerUrl', 'walruscanBlobUrl'])

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
const NATIVE = `:matches(VElement[rawName=/^[a-z][a-z0-9]*$/], VElement[rawName=/^(${NATIVE_TAGS.join('|')})$/i])`

const allowedSui = ALLOWED_SUI_SUBPATHS.join('|')
const SUI_RESTRICTED_SOURCE = `/^@mysten\\/sui\\/(?!(${allowedSui})$)/`

/** @param {string} name */
const restrictedImportMessage = (name) =>
  `No chain access in app code: use the domain client or the wallet-adapter (type-only imports of ${name} are fine).`

/**
 * `@typescript-eslint/no-restricted-imports` options: any `@mysten/sui/*` subpath except the allowed ones
 * (type-only imports stay allowed); JSON-RPC never.
 */
export const restrictedImportOptions = Object.freeze({
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

// Method names that are specific to building Sui transactions: ANY reference is refused (a call, `.bind`,
// destructuring, computed access).
const COMMANDS = ['moveCall', 'splitCoins', 'mergeCoins', 'transferObjects', 'makeMoveVec']
// Generic names, refused only as calls (they are common outside Sui: `bus.publish(...)`).
const GENERIC_COMMANDS = ['publish', 'upgrade']
// Chain reads, refused as calls. Balance and epoch reads (`getBalance`, `listBalances`,
// `getCurrentSystemState`) are deliberately allowed: they are typed, domain-free queries (ADR-0001 note).
const READS = [
  'getObject', 'getObjects', 'listOwnedObjects', 'getOwnedObjects', 'listEvents', 'queryEvents', 'listCoins',
  'listDynamicFields', 'getDynamicField', 'getTransaction', 'simulateTransaction', 'executeTransaction',
]
/** @param {string[]} names */
const anyOf = (names) => names.join('|')

const IMPORT_MESSAGE = 'No chain access in app code: use the domain client or the wallet-adapter.'

/** `no-restricted-syntax` entries about importing (dynamic `import()` / `require`) the restricted paths. */
const importSyntax = [
  { selector: `ImportExpression[source.value=${SUI_RESTRICTED_SOURCE}]`, message: IMPORT_MESSAGE },
  { selector: "ImportExpression[source.type='TemplateLiteral'][source.quasis.0.value.raw=/@mysten\\//]", message: IMPORT_MESSAGE },
  { selector: "ImportExpression[source.type='BinaryExpression'][source.left.value=/@mysten\\//]", message: IMPORT_MESSAGE },
  { selector: `CallExpression[callee.name='require'][arguments.0.value=${SUI_RESTRICTED_SOURCE}]`, message: IMPORT_MESSAGE },
]

/** `no-restricted-syntax` entries about building transactions and reading chain objects. */
const chainSyntax = [
  { selector: "NewExpression[callee.name='Transaction']", message: 'Build transactions in the domain client, not in app code.' },
  { selector: "MemberExpression[object.name='Transaction']", message: 'Build transactions in the domain client, not in app code (`Transaction.from` and the other statics included).' },
  { selector: `MemberExpression[property.name=/^(${anyOf(COMMANDS)})$/]`, message: 'Transaction commands belong in the domain client (extend it instead).' },
  { selector: `MemberExpression[computed=true][property.value=/^(${anyOf([...COMMANDS, ...GENERIC_COMMANDS, ...READS])})$/]`, message: 'Chain access by computed property name is refused too: use the domain client.' },
  { selector: `ObjectPattern > Property[key.name=/^(${anyOf(COMMANDS)})$/]`, message: 'Transaction commands belong in the domain client (destructuring them does not change that).' },
  { selector: `CallExpression[callee.property.name=/^(${anyOf(GENERIC_COMMANDS)})$/]`, message: 'Transaction commands belong in the domain client (extend it instead).' },
  { selector: `CallExpression[callee.property.name=/^(${anyOf(READS)})$/]`, message: 'Chain reads belong in the domain client (it pages, type-checks and validates).' },
]

/** `no-restricted-syntax` entries for script code in app files. */
export const scriptRestrictions = Object.freeze([...chainSyntax, ...importSyntax].map((r) => Object.freeze(r)))

/** The same without the import entries — for the wallet shim, which may import the client but nothing else. */
export const walletRestrictions = Object.freeze(chainSyntax.map((r) => Object.freeze(r)))

/**
 * Escape a helper name for use inside a selector regular expression.
 * @param {string} name
 */
function escapeName(name) {
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
  const safe = `Literal, TemplateLiteral[expressions.length=0], Identifier[name='undefined'], CallExpression[callee.name=/^(${helpers})$/]`
  const safeOrTernaryOfSafe =
    `${safe}, ConditionalExpression:not(:has(> .consequent:not(${safe}))):not(:has(> .alternate:not(${safe})))`
  const bind = "VAttribute[directive=true][key.name.name='bind']"
  const message = `Bind URLs on native elements through ${urlHelpers.join(', ')} (or a literal).`
  return [
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
    const braces = f.match(/^(.*)\.\{([^}]*)\}$/)
    if (braces) {
      if (braces[2].split(',').map((e) => e.trim()).includes('vue')) out.push(`${braces[1]}.vue`)
    } else if (f.endsWith('.vue')) out.push(f)
  }
  return [...new Set(out)]
}

const TS_EXTENSIONS = ['ts', 'mts', 'cts', 'tsx', 'vue']
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
    const braces = f.match(/^(.*)\.\{([^}]*)\}$/)
    const base = braces ? braces[1] : f.replace(/\.[A-Za-z]+$/, '')
    const exts = braces ? braces[2].split(',').map((e) => e.trim()) : [f.slice(base.length + 1)]
    const pick = (/** @type {string[]} */ list) => exts.filter((e) => list.includes(e))
    const t = pick(TS_EXTENSIONS)
    const j = pick(JS_EXTENSIONS)
    const glob = (/** @type {string[]} */ list) => `${base}.${list.length === 1 ? list[0] : `{${list.join(',')}}`}`
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
