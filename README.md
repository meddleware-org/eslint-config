# @meddleware/eslint-config

Shared ESLint flat-config fragments for MeddleWare apps. They enforce the chain-access boundary
(workspace ADR-0001): apps call the domain clients — `@meddleware/access-gate-client`,
`@meddleware/seal-client`, `@meddleware/walrus-client`, `@meddleware/sui-token-client` — and the
wallet-adapter; they never build transactions or read chain objects themselves. A template rule keeps
URL bindings on native elements sanitised.

## Use

```ts
// eslint.config.ts — after the repo's Vue + TypeScript configs
import { suiBoundary } from '@meddleware/eslint-config'

export default defineConfigWithVueTs(
  // …the repo's existing entries…
  ...suiBoundary(),
)
```

Append it **last**. It relies on the `@typescript-eslint` and `vue` plugins the repo already registers
(e.g. via `@vue/eslint-config-typescript` and `eslint-plugin-vue`).

**It replaces your own restriction rules.** ESLint does not merge rule options across config objects: for the
files the boundary covers, its `no-restricted-syntax`, `vue/no-restricted-syntax` and
`@typescript-eslint/no-restricted-imports` options replace yours, silently. Pass your own restrictions
through `extraSyntax`, `extraTemplateSyntax` and `extraImportPaths` so they stay in force.

## What it enforces (in `src/**/*.{ts,mts,cts,tsx,js,mjs,cjs,jsx,vue}`, except tests)

| Rule | Refuses |
| --- | --- |
| `@typescript-eslint/no-restricted-imports` (core `no-restricted-imports` for `.js` files) | runtime imports of any `@mysten/sui/*` subpath except `utils` and `bcs` (type-only imports allowed); any import of `@mysten/sui/jsonRpc`, even type-only |
| `no-restricted-syntax` | `new Transaction()` and its statics (`Transaction.from`); any reference to `moveCall`, `splitCoins`, `mergeCoins`, `transferObjects`, `makeMoveVec` (calls, `.bind`, destructuring, `tx['moveCall']`); calls to `publish`, `upgrade`; calls to `getObject(s)`, `listOwnedObjects`, `getOwnedObjects`, `listEvents`, `queryEvents`, `listCoins`, `listDynamicFields`, `getDynamicField`, `getTransaction`, `simulateTransaction`, `executeTransaction`; dynamic `import()` (string, template or concatenation) and `require()` of the restricted paths |
| `vue/no-restricted-syntax` | on a native element (any tag case): a bound `href`, `src`, `srcset`, `action`, `formaction`, `poster`, `data`, `xlink:href`, `ping` or `imagesrcset` unless it is a literal, `undefined`, a call to `safeHref`, `safeIcon`, `suiExplorerUrl`, `walruscanBlobUrl`, or a ternary of those; any bound `srcdoc` or `<meta content>`; `v-bind="object"` and `:[dynamic]` names; `url(...)` in a bound `style` |
| `vue/no-v-html` | `v-html` |

Balance and epoch reads (`getBalance`, `listBalances`, `getCurrentSystemState`) are **allowed**: they are
typed, domain-free queries. `src/wallet.ts` (the wallet shim, `walletFiles`) may import the client but
still may not build transactions or read objects. Components are exempt from the template rule: a
component sanitises its own props.

### What it cannot do

The selectors are name-based. They catch accidents and shortcuts (including an agent "fixing" lint by
rewording a call), not evasion: a value passed through an arbitrary re-export or helper is not followed;
a local `const safeHref = (u) => u` satisfies the template rule; `bus.upgrade()` and `x.publish()` calls are
refused too (generic names), so a repository that uses them elsewhere should scope `files`. Review stays the
control for anything a selector cannot see.

## Options

```ts
suiBoundary({
  files: ['app/**/*.{ts,vue}'],          // where the boundary applies (the template rule follows its .vue entries)
  vueFiles: ['app/**/*.vue'],            // optional: override the derived .vue globs
  ignores: ['**/*.test.ts'],             // exempt entirely (default: tests)
  walletFiles: ['app/wallet.ts'],        // the wallet shim(s) (default: src/wallet.ts)
  urlHelpers: ['myCdnUrl'],              // extra URL helpers this repo provides
  extraSyntax: [{ selector: 'ForInStatement', message: 'no for-in' }],
  extraTemplateSyntax: [],               // your own vue/no-restricted-syntax entries
  extraImportPaths: [{ name: 'lodash', message: 'use the platform' }],
})
```

If no entry of `files` can match a `.vue` file, the template rule is simply not emitted.

The building blocks are exported too: `restrictedImportOptions`, `scriptRestrictions`,
`walletRestrictions`, `templateUrlRestrictions(helpers)`, `splitGlobs`, `vueGlobs`, `URL_HELPERS`,
`URL_ATTRIBUTES`, `REFUSED_ATTRIBUTES`, `ALLOWED_SUI_SUBPATHS`.

Use `eslint --report-unused-disable-directives` and require a reason on every `eslint-disable` of these
rules: a disable also hides a real hit.

## License

BSD Zero Clause License (`0BSD`). See [LICENSE](LICENSE).
