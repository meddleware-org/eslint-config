# CLAUDE.md — @meddleware/eslint-config

Flat-config fragments enforcing the chain-access boundary (workspace ADR-0001, B8) and sanitised URL
bindings in Vue templates. Source is `src/index.js` (ESM with JSDoc types; `.d.ts` built by `tsc`).

## Invariants

- **No runtime dependencies, no plugins declared.** Consumers register `@typescript-eslint` and `vue`;
  `eslint` is a peer. Keep it that way so every repo uses its own plugin versions.
- **Every selector is proven by a fixture test** (`tests/boundary.test.ts`, ESLint `Linter` with the
  same parsers the apps use) in both directions: a violation is reported, and the allowed form is not.
  Add both cases with any new selector.
- **Type-only imports stay allowed** (`allowTypeImports`); JSON-RPC is refused outright.
- **Components are exempt from the template rule**; only native lowercase elements are checked.

## Release

Bump `version`, push, tag `v<version>`; `npm-publish.yml` publishes with npm trusted publishing.
Consumers (walrus-ui, walrus-relay, access-gate-ui, seal-ui, dao-ui, treasury-ui, token-deployer-ui,
dashboard) take `^0.0.x` — an exact pin on 0.0.x — so bump them together.
