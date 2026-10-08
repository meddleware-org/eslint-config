# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.2] - 2026-10-08

Pre-v0.2: breaking changes are patch releases.

### Fixed

- **`files` no longer crashes or silently loses the template rule.** The `.vue` globs are derived from
  `files` (`vueGlobs`), so a TS-only `files` emits no template config, and a non-`src` root keeps the
  rule where the components are. Plain `.js`/`.mjs`/`.cjs` files get the core import rule, so the
  TypeScript plugin need not be registered for them.
- **The boundary no longer erases the consumer's own restrictions without a way to keep them:**
  `extraSyntax`, `extraTemplateSyntax` and `extraImportPaths` are merged into the emitted options (ESLint still
  replaces rule options across config objects, which the README now states first).
- **Script boundary variants:** any reference to a Sui command (not only a call: `.bind`, destructuring,
  `tx['moveCall']`), `Transaction.from` and the other statics, computed access to the read methods,
  dynamic `import()` from a template literal or concatenation, `require()`, the reads that were missing
  (`listCoins`, `listDynamicFields`, `getDynamicField`, `getTransaction`, `simulateTransaction`,
  `executeTransaction`), `.js/.cjs/.mjs/.cts/.jsx` files, and every `@mysten/sui/*` subpath except `utils`
  and `bcs` (so `graphql`, `faucet`, `cryptography` …).
- **Template sinks:** `xlink:href`, `ping`, `imagesrcset`, bound `srcdoc` and `<meta content>`, argument-less
  `v-bind` and dynamic argument names, upper-case native tags, `url(...)` in a bound `style`, and `v-html`.
  A ternary whose branches are both safe is accepted; a helper name with a regular-expression character is
  escaped instead of silently never matching.
- **`src/wallet.ts` is no longer exempt from everything:** it may import the client but still may not build
  transactions or read objects (`walletFiles`).

### Changed

- `restrictedImportPaths` is replaced by `restrictedImportOptions` (paths and patterns);
  `walletRestrictions`, `splitGlobs`, `vueGlobs`, `REFUSED_ATTRIBUTES` and `ALLOWED_SUI_SUBPATHS` are new.
- Balance and epoch reads are documented as allowed (the previous behaviour; ADR-0001 note).
- CI runs a build and a package-contents check, and the tag workflow runs the same workflow as CI (no
  `--if-present`).
- `SECURITY.md` added; `sideEffects: false` declared.

## [0.0.1] - 2026-10-02

First release (B8).

### Added

- `suiBoundary(options)` — the chain-access boundary for app `src/`: restricted `@mysten/sui`
  imports (type-only allowed, JSON-RPC refused), transaction-building and chain-read calls, dynamic
  imports; plus the native-element URL-binding rule.
- Building blocks: `restrictedImportPaths`, `scriptRestrictions`, `templateUrlRestrictions`,
  `URL_HELPERS`, `URL_ATTRIBUTES`.
