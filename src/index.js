// @ts-check
// @meddleware/eslint-config — flat-config fragments that keep apps on the right side of the chain-access
// boundary (workspace ADR-0001): apps call domain clients (access-gate-client, seal-client,
// walrus-client, sui-token-client, the wallet-adapter); they never build transactions or read chain
// objects themselves. Plus a template rule that keeps URL bindings on native elements sanitised.
//
// Consumers already register the `@typescript-eslint` and `vue` plugins (e.g. through
// `@vue/eslint-config-typescript` and `eslint-plugin-vue`); this package declares no plugins and has no
// runtime dependencies.

/** Helpers whose return value is a safe URL (or undefined) for a native element binding. */
export const URL_HELPERS = Object.freeze(['safeHref', 'safeIcon', 'suiExplorerUrl', 'walruscanBlobUrl'])

/** Native-element attributes that load or navigate to a URL. */
export const URL_ATTRIBUTES = Object.freeze(['href', 'src', 'srcset', 'action', 'formaction', 'poster', 'data'])

const RUNTIME_PATHS = ['@mysten/sui/grpc', '@mysten/sui/client', '@mysten/sui/transactions']

/** `@typescript-eslint/no-restricted-imports` paths: type-only imports stay allowed; JSON-RPC never. */
export const restrictedImportPaths = Object.freeze([
  ...RUNTIME_PATHS.map((name) =>
    Object.freeze({
      name,
      allowTypeImports: true,
      message: `No chain access in app code: use the domain client or the wallet-adapter (type-only imports of ${name} are fine).`,
    }),
  ),
  Object.freeze({
    name: '@mysten/sui/jsonRpc',
    message: 'Public fullnodes have dropped JSON-RPC; use the domain client (gRPC).',
  }),
])

const BUILD_METHODS = ['moveCall', 'splitCoins', 'mergeCoins', 'transferObjects', 'publish', 'upgrade', 'makeMoveVec']
const READ_METHODS = ['getObject', 'getObjects', 'listOwnedObjects', 'getOwnedObjects', 'listEvents', 'queryEvents']

/** `no-restricted-syntax` entries for script code. */
export const scriptRestrictions = Object.freeze([
  Object.freeze({
    selector: "NewExpression[callee.name='Transaction']",
    message: 'Build transactions in the domain client, not in app code.',
  }),
  Object.freeze({
    selector: `CallExpression[callee.property.name=/^(${BUILD_METHODS.join('|')})$/]`,
    message: 'Transaction commands belong in the domain client (extend it instead).',
  }),
  Object.freeze({
    selector: `CallExpression[callee.property.name=/^(${READ_METHODS.join('|')})$/]`,
    message: 'Chain reads belong in the domain client (it pages, type-checks and validates).',
  }),
  Object.freeze({
    selector: 'ImportExpression[source.value=/^@mysten\\/sui\\/(grpc|client|transactions|jsonRpc)$/]',
    message: 'No chain access in app code: use the domain client or the wallet-adapter.',
  }),
])

/**
 * `vue/no-restricted-syntax` entries: a URL attribute bound on a native element must be a literal or
 * the result of a URL helper. Components are exempt — a component sanitises its own props.
 *
 * @param {readonly string[]} [urlHelpers] helper names that return a safe URL (defaults to URL_HELPERS)
 * @returns {{ selector: string, message: string }[]}
 */
export function templateUrlRestrictions(urlHelpers = URL_HELPERS) {
  const helpers = urlHelpers.map((h) => h.replace(/[^A-Za-z0-9_$]/g, '')).join('|')
  const attrs = URL_ATTRIBUTES.join('|')
  const safe = `Literal, TemplateLiteral[expressions.length=0], CallExpression[callee.name=/^(${helpers})$/]`
  return [
    {
      selector:
        `VElement[rawName=/^[a-z][a-z0-9]*$/] > VStartTag > ` +
        `VAttribute[directive=true][key.name.name='bind'][key.argument.name=/^(${attrs})$/] > ` +
        `VExpressionContainer > .expression:not(${safe})`,
      message: `Bind URLs on native elements through ${urlHelpers.join(', ')} (or a literal).`,
    },
  ]
}

/**
 * @typedef {object} SuiBoundaryOptions
 * @property {string[]} [files] files the boundary applies to (default: app `src/`)
 * @property {string[]} [ignores] files exempt (default: `src/wallet.ts` and tests)
 * @property {string[]} [urlHelpers] extra URL helpers this repo provides
 */

/**
 * The boundary as flat-config objects. Append it **last** in `eslint.config.ts`, so its rule options
 * are the ones in force.
 *
 * @param {SuiBoundaryOptions} [options]
 * @returns {import('eslint').Linter.Config[]}
 */
export function suiBoundary(options = {}) {
  const files = options.files ?? ['src/**/*.{ts,mts,tsx,vue}']
  const ignores = options.ignores ?? ['src/wallet.ts', '**/*.{test,spec}.{ts,mts,tsx}', '**/__tests__/**']
  return [
    {
      name: '@meddleware/eslint-config/sui-boundary',
      files,
      ignores,
      rules: {
        'no-restricted-imports': 'off',
        '@typescript-eslint/no-restricted-imports': ['error', { paths: [...restrictedImportPaths] }],
        'no-restricted-syntax': ['error', ...scriptRestrictions],
      },
    },
    {
      name: '@meddleware/eslint-config/template-urls',
      files: files.filter((f) => f.includes('vue')).length ? ['src/**/*.vue'] : [],
      ignores,
      rules: {
        'vue/no-restricted-syntax': ['error', ...templateUrlRestrictions([...URL_HELPERS, ...(options.urlHelpers ?? [])])],
      },
    },
  ]
}
