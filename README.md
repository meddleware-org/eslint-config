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

Append it **last**, so its rule options are the ones in force. It relies on the `@typescript-eslint`
and `vue` plugins the repo already registers (e.g. via `@vue/eslint-config-typescript` and
`eslint-plugin-vue`).

## What it enforces (in `src/**/*.{ts,mts,tsx,vue}`, except `src/wallet.ts` and tests)

| Rule | Refuses |
| --- | --- |
| `@typescript-eslint/no-restricted-imports` | runtime imports of `@mysten/sui/grpc`, `/client`, `/transactions` (type-only imports allowed); any import of `@mysten/sui/jsonRpc` |
| `no-restricted-syntax` | `new Transaction()`; `.moveCall`, `.splitCoins`, `.mergeCoins`, `.transferObjects`, `.publish`, `.upgrade`, `.makeMoveVec`; `.getObject(s)`, `.listOwnedObjects`, `.getOwnedObjects`, `.listEvents`, `.queryEvents`; dynamic `import()` of the restricted paths |
| `vue/no-restricted-syntax` | a bound `href`, `src`, `srcset`, `action`, `formaction`, `poster` or `data` on a native element unless it is a literal or a call to `safeHref`, `safeIcon`, `suiExplorerUrl`, `walruscanBlobUrl` |

Components are exempt from the template rule: a component sanitises its own props.

## Options

```ts
suiBoundary({
  files: ['src/**/*.{ts,vue}'],          // where the boundary applies
  ignores: ['src/wallet.ts', '**/*.test.ts'],
  urlHelpers: ['myCdnUrl'],              // extra URL helpers this repo provides
})
```

The building blocks are exported too: `restrictedImportPaths`, `scriptRestrictions`,
`templateUrlRestrictions(helpers)`, `URL_HELPERS`, `URL_ATTRIBUTES`.

## License

BSD Zero Clause License (`0BSD`). See [LICENSE](LICENSE).
