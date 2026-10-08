# CLAUDE.md — @meddleware/eslint-config

Flat-config fragments enforcing the chain-access boundary (workspace ADR-0001, B8) and sanitised URL
bindings in Vue templates. Source is `src/index.js` (ESM with JSDoc types; `.d.ts` built by `tsc`).

## Invariants

- **No runtime dependencies, no plugins declared.** Consumers register `@typescript-eslint` and `vue`;
  `eslint` is a peer. Keep it that way so every repo uses its own plugin versions.
- **Every selector is proven by a fixture test** (`tests/boundary.test.ts`, ESLint `Linter` with the
  same parsers the apps use) in both directions: a violation is reported, and the allowed form is not.
  Add both cases with any new selector.
- **Type-only imports stay allowed** (`allowTypeImports`); JSON-RPC is refused outright (it is excluded
  from the `@mysten/sui/*` pattern so the `paths` entry applies: a matching pattern with
  `allowTypeImports` would let the type import through).
- **The boundary replaces, never merges, the consumer's restriction rules** (ESLint semantics). Anything a
  consumer needs kept goes through `extraSyntax` / `extraTemplateSyntax` / `extraImportPaths`.
- **TS/Vue files use the `@typescript-eslint` import rule; plain JS files the core one** (`splitGlobs`), so the
  plugin need not be registered for JS. The template rule applies only to the `.vue` globs derived from
  `files` (`vueGlobs`), never to files the `vue` plugin is not set up for.
- **Components are exempt from the template rule**; only native elements (lower-case, or a known native tag
  in any case) are checked.
- **Allowed on purpose:** `@mysten/sui/utils` and `/bcs` at runtime; balance and epoch reads. Adding to
  either list is a decision (ADR-0001), not a fix for a lint error.
- **The rules catch accidents, not evasion** — say so wherever the boundary is cited as a control.

## Release

Bump `version`, push, tag `v<version>`; `npm-publish.yml` publishes with npm trusted publishing.
Consumers (walrus-ui, access-gate-ui, seal-ui, dao-ui, treasury-ui, token-deployer-ui, dashboard, landing)
take `^0.0.x` — an exact pin on 0.0.x — so bump them together. CI and the tag workflow run the same
`node-ci.yml` (audit, type-check, tests, build, package contents).
