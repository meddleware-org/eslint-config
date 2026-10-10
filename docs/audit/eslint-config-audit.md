# Security Audit — `eslint-config`

**Classification:** Internal security review (initial audit — awaiting external review)
**Project:** eslint-config (`@meddleware/eslint-config`) — shared ESLint flat-config fragments.

- `suiBoundary()` mechanises the workspace chain-access boundary (ADR-0001, B8) for app `src/`.
  Apps call the domain clients (access-gate-client, seal-client, walrus-client, sui-token-client)
  and the wallet-adapter; they never build transactions or read chain objects themselves.
- A Vue template rule keeps URL bindings on native elements to a literal or a sanitising helper.
  This mechanises the URL half of VUE-M1 for every consumer.

**Project type:** TS/JS tooling package. An npm package of ESM JavaScript with JSDoc types and a
declaration build.
**Template:**

- AUDIT_TEMPLATE.md (2026-10-08)
- AUDIT_TEMPLATE_TS.md (2026-10-08)

Not triggered: SUI and SUI_CLIENT (no Move code and no chain access — the package *restricts* chain
access in others), VUE (not a Vue app or component library; it lints Vue templates, it does not ship
any), SEAL, WALRUS, WORKERS, AUTH, PROXY, OPS (no signing scripts), IMG (npm package, no image),
RUST, GO, SITE, PLATFORM.

The template rule is assessed against **VUE-M1**, the requirement it mechanises for consumers, and the
script rules against the ADR-0001 boundary as stated in consumers' CLAUDE.md files.

**Deployment status:**

- npm **`0.0.2` is `latest`** (published 2026-10-08 10:46Z, OIDC provenance attestation present); tag
  `v0.0.2` → `5e959bf` (2026-10-08). `0.0.1` is published too (2026-10-08 02:43Z, provenance); tag
  `v0.0.1` → `336c566`. Both tags are lightweight (unsigned).
- HEAD `0a7ca84` (2026-10-09) is a Dependabot lockfile bump after `v0.0.2`; it changes no shipped file
  and is not released.
- npm `0.0.0` (the 3-file, 1,338-byte placeholder, no provenance) was **deprecated 2026-10-09**
  (`Placeholder release; use 0.0.1 or later.`).
- **All eight consumers apply `suiBoundary()` at `^0.0.2`** (adopted 2026-10-08; F1). `landing` and
  `ui` do not (F13).

**Review date:** 2026-10-03; re-verified 2026-10-09
**Reviewer:** Internal review
**Severity ceiling:** Medium.

- This is a CI guardrail, not a runtime component: it neither signs, holds secrets nor ships code to
  browsers.
- Its failure modes are *missed enforcement*: chain logic or unsanitised URL sinks entering apps
  unnoticed. Each consumer's own audit, and the code itself, remain the line of defence.
- A defect here cannot by itself move funds or execute code. It removes a control that consumer
  audits (VUE-M1, ADR-0001) count on.
- Realised ceiling at this pass: **Low**.

**Status:** re-verified 2026-10-09. First-pass baseline 2026-10-03 (no predecessor audit); F1–F9 were
remediated in `0.0.2` and the package is in force in eight consumers. Three findings were added at the
re-verification (F12–F14).

**Front matter (TS lens):**

| Field | Value |
| --- | --- |
| Package manager / lockfile | npm; `package-lock.json` committed |
| Module format | ESM (`"type": "module"`) |
| Publish model | ships `src/index.js` (`default`) + `dist/index.d.ts` (`types`, built by `prepublishOnly` → `tsc -p tsconfig.build.json`) |
| Runtime targets | Node, running ESLint |
| Peer dependencies | `eslint ^10.0.0` (plugins `@typescript-eslint` and `vue` deliberately undeclared; the consumer registers them) |
| Runtime dependencies | none |
| Intended consumers (CLAUDE.md) | walrus-ui, walrus-relay, access-gate-ui, seal-ui, dao-ui, treasury-ui, token-deployer-ui, dashboard, landing. The first eight apply `suiBoundary()` at `^0.0.2`; `landing` does not (F13). All use `@vue/eslint-config-typescript ^14.9.0`. |

**Location:** `eslint-config/docs/audit/eslint-config-audit.md`. This is a new directory in the
repo (not yet committed at 2026-10-09).

> **Access note:** `meddleware-org/eslint-config` was not in the first session's attached repository
> list. It is public, so it was cloned read-only; the workspace checkout `repos/eslint-config` is used
> for the 2026-10-09 re-verification. Nothing was pushed.

---

## Executive summary

The package is one 308-line module (`src/index.js`) and one fixture test file (35 tests). It exports:

- `suiBoundary(options)`, which returns up to four flat-config objects (TS/Vue script rules, plain-JS
  rules, the wallet shim, the Vue template rule);
- the building blocks `restrictedImportOptions`, `scriptRestrictions`, `walletRestrictions`,
  `templateUrlRestrictions`, `splitGlobs`, `vueGlobs`, `URL_HELPERS`, `URL_ATTRIBUTES`,
  `REFUSED_ATTRIBUTES` and `ALLOWED_SUI_SUBPATHS`.

**State at 2026-10-09:** the first pass (2026-10-03, `0f2ee0d`) found nothing in force and several
coverage gaps. `0.0.2` (2026-10-08, `5e959bf`) fixed F2–F9, `0.0.1` and `0.0.2` are on npm with
provenance, and all eight consumers apply `suiBoundary()` at `^0.0.2` and lint clean (F1). The `0.0.0`
placeholder was deprecated on npm 2026-10-09.

**What holds (verified 2026-10-09):**

- **Fixture tests in both directions.** 35 tests through ESLint's `Linter`, with the same parsers the
  apps use (`typescript-eslint`, `vue-eslint-parser`). Each selector has a "reported" case and an
  "allowed" case; options (`files`, `extra*`, wallet shim) are covered too.
- **Import rules.**
  - Runtime imports of any `@mysten/sui/*` subpath except `utils` and `bcs` are refused; type-only imports
    are allowed.
  - `@mysten/sui/jsonRpc` is refused even as a type import.
  - Re-exports, dynamic `import()` (string, template, concatenation) and `require()` are refused.
- **Call rules.** `new Transaction()` and its statics, any reference to the PTB commands (call, `.bind`,
  destructuring, computed), and the object, event, coin, dynamic-field and transaction reads are refused.
  Balance and epoch reads are allowed on purpose (OQ1 decided).
- **Template rule.** URL attributes bound on native elements (any tag case) must be a literal, a static
  template string, `undefined`, a call to a named helper or a ternary of those. `srcdoc`, `<meta content>`,
  argument-less `v-bind`, dynamic names, `url()` in `style` and `v-html` are refused. Components are exempt
  by design.
- **Package hygiene.** No runtime dependencies; frozen exported constants; `checkJs` + `strict`;
  declarations built for consumers; `files` whitelist (6 files, 9.1 kB packed); `sideEffects: false`;
  SECURITY.md.
- **Release chain.** SHA-pinned actions, actionlint by digest, `npm audit` in CI and publish, OIDC
  `--provenance`, tag = version, the tag workflow runs the same workflow as CI, Dependabot.
- **In force.** The eight consumers pass under the default options.

**Findings (14 recorded; none above Low):**

- **Resolved (F1–F9):** F1 (published and adopted), F2 (`files` handling), F3 (`extra*` options),
  F4 (script variants; OQ1 decided), F5 (template sinks and `vue/no-v-html`), F6, F7 (wallet shim), F8, F9.
- **Accepted risk (F12):** residual evasion forms of a name-based rule (`tx.add`, aliased `Transaction`,
  destructured reads, `:innerHTML.prop`, local helpers named like trusted ones).
- **Deferred (F13, F14):** `landing` and `ui` do not apply the boundary (S2; pre-mainnet gate), and
  consumer CI runs `lint:js` with `--if-present` (pre-mainnet gate).
- **Positive (F10, F11).**

**Posture:**

- The package is small, well-tested in both directions, dependency-free, published with provenance and
  in force in eight consumers.
- The remaining limits (F12) are inherent to name-based selectors and are stated in the README,
  CLAUDE.md and SECURITY.md. Treat it as an accident-catcher for developers and agents, not as a
  guarantee; consumer audits should cite A3–A6 below, not "enforced by `@meddleware/eslint-config`".
- Open for mainnet: F13, F14, and external review.

---

## Threat model / trust boundaries

| Actor / source | Controls | Can do | Bounded by |
| --- | --- | --- | --- |
| App developer or coding agent (honest) | app source | Accidentally build PTBs, read chain objects, or bind an unsanitised URL in an app | `suiBoundary()`, applied in eight consumers (F1); coverage limits in F12; `landing` and `ui` outside it (F13) |
| Coding agent "fixing" a lint error | app source | Rewrite a flagged call into an unflagged form: destructuring, computed access, renamed helper | Code review; consumer audits. The rule is evadable by construction (F12; most variants closed in 0.0.2, F4, F5) |
| Consumer's ESLint config | config order, options, plugins | Weaken or misapply the boundary through options or order | Documented "append last" and replacement semantics; `files` handling fixed (F2); `extra*` options keep own rules (F3). A removed or `--if-present`-masked `lint:js` drops the boundary (F14) |
| Dependency authors (dev only) | ESLint, typescript-eslint, eslint-plugin-vue, vue-eslint-parser | Change AST shapes or selector semantics | Fixture tests in CI. Consumers bring their own plugin versions, so a consumer upgrade can silently change matching (S3) |
| npm registry / publisher | the published tarball | Ship a weakened rule set to every consumer | OIDC provenance on publish (0.0.1 and 0.0.2 carry attestations; the 0.0.0 placeholder has none and is deprecated) |

### Supply chain & input matrix (TS lens)

| Actor / source | Controls | Bounded by |
| --- | --- | --- |
| Dependency authors | dev-only toolchain; no runtime dependencies | lockfile; `npm ci`; `npm audit --audit-level=high` in CI and publish |
| Untrusted inputs | none at runtime. Options (`files`, `ignores`, `urlHelpers`) come from the consumer's own config | `urlHelpers` stripped to identifier characters before entering a selector regex (`escapeName`, `index.js:107-109`) |
| Embedding host | the consumer's ESLint run | runs only in the consumer's lint step |

---

## Severity scale

Critical / High / Medium / Low / Info / Positive.

## Scope

**In scope (HEAD `0a7ca84`; tag `v0.0.2` = `5e959bf`; tag `v0.0.1` = `336c566`):**

- `src/index.js`
- `tests/boundary.test.ts`
- `package.json`, `package-lock.json`, `tsconfig.json`, `tsconfig.build.json`, `.gitignore`
- `README.md`, `CLAUDE.md`, `CHANGELOG.md`, `SECURITY.md`, `LICENSE`
- `.github/workflows/{node-ci,npm-publish}.yml`, `.github/dependabot.yml`

**Cross-repo evidence (read-only, workspace checkouts under `repos/`; first pass 2026-10-03, re-checked 2026-10-09):**

- The eight adopting consumers' `package.json`, `eslint.config.ts`, `node-ci.yml` and `src/` (lint run); `landing` and `ui` configs and the `ui` components.
- `ui/src/components/{ExplorerLink,AppFooter,CopyrightLine,StatusWidget}.vue`, to test the premise of
  the component exemption.

**Out of scope:**

- the consumers' own audits;
- `@meddleware/ui`'s `safeHref` implementation (covered in the ui audit);
- ESLint and plugin internals.

**Environment / commands (re-run 2026-10-09, Node v24.13.0; first pass 2026-10-03 on Node 22.22.2 in brackets):**

| Command | Result |
| --- | --- |
| `npm ci` | clean |
| `npx vitest run` | **35 passed** (1 file) [12] |
| `npm run type-check` | clean (`checkJs`, `strict`) |
| `npm audit --audit-level=high` | 0 vulnerabilities |
| `npm pack --dry-run` | 6 files, 9.1 kB packed / 31.2 kB unpacked (`CHANGELOG.md`, `LICENSE`, `README.md`, `dist/index.d.ts`, `package.json`, `src/index.js`) [4.4 kB] |
| `npm ls --depth=0` | eslint 10.11.0, typescript-eslint 8.71.0, eslint-plugin-vue 10.11.1, vue-eslint-parser 10.4.1, vitest 5.0.3, typescript 6.0.3, @types/node 24.12.4 |
| `npm view @meddleware/eslint-config` | versions `0.0.0` (deprecated), `0.0.1`, `0.0.2` (`latest`); `0.0.1` and `0.0.2` carry provenance attestations [`["0.0.0"]`, none] |
| Scratch probe (26 cases, test file removed afterwards) | F2, F4, F5, F7 re-probed against `0.0.2`; the forms still passing are listed in F12. |
| Consumer lint (`npx eslint .` in each adopting consumer) | access-gate-ui, dao-ui, dashboard, seal-ui, token-deployer-ui, treasury-ui, walrus-relay, walrus-ui: **exit 0**, each with `@meddleware/eslint-config` 0.0.2 installed. First pass: scratch sweep of 123 files, 0 messages. |
| Actions run history | not read (no `gh` access used); the registry's publish timestamps and attestations stand in for it |

The checkout was left unchanged (probe file removed). `git status` shows only `docs/` untracked.

---

## Findings

### F1 — The boundary is not in force: 0.0.1 is unpublished and no consumer applies it

**Severity:** Low   **Disposition:** RESOLVED
**Where (as found 2026-10-03):** npm registry (`0.0.0` only); tag `v0.0.1` → `336c566`; CLAUDE.md "Release" section;
consumers' `package.json` and `eslint.config.ts` (no reference to `@meddleware/eslint-config` or
`suiBoundary` in any of the eight).

**Issue (as found 2026-10-03):**

- **Not published.** `CHANGELOG.md` records 0.0.1 as released on 2026-10-02 and the tag exists, but
  npm serves only the placeholder `0.0.0` (3 files, no rules, no provenance). The publish run's
  outcome could not be read. Possible causes include a failed `verify` job, an untriggered workflow,
  or the trusted publisher not matching `npm-publish.yml`.
- **Not adopted.** No consumer depends on the package, so no consumer lint run enforces either rule.
- **Unenforced elsewhere too.** The consumers' CLAUDE.md invariants ("Do not add `moveCall`s / RPC
  parsing here") and VUE-M1's URL allowlist are therefore enforced only by review.
- CLAUDE.md's statement that consumers "take `^0.0.x`" is not true yet.

**Impact:** chain logic or an unsanitised URL sink can enter any app without a CI signal. Today the
sweep finds none (F11), so the exposure is future drift, not an existing defect.

**Remediation / evidence:** RESOLVED 2026-10-08 (re-verified 2026-10-09).

- **Published, with provenance.** The registry lists `0.0.0`, `0.0.1` (2026-10-08 02:43Z) and `0.0.2`
  (2026-10-08 10:46Z, `latest`); `0.0.1` and `0.0.2` carry an SLSA provenance attestation. Tag
  `v0.0.2` → `5e959bf` ("Boundary variants, files/vueFiles derivation, extra* options, wallet shim
  narrowed, release gate parity; 0.0.2"). The cause of the first `v0.0.1` run not publishing is not
  recorded (OQ3); the same workflow published it six days later.
- **Placeholder retired.** `0.0.0` was deprecated on npm 2026-10-09 (`Placeholder release; use 0.0.1 or
  later.`).
- **Adopted in eight consumers**, each with a "Enforce the chain-access boundary (@meddleware/eslint-config
  suiBoundary)" commit of 2026-10-08, `"@meddleware/eslint-config": "^0.0.2"` and `...suiBoundary()` last
  in `eslint.config.ts`: access-gate-ui `90a0628`, dao-ui `8ec7502`, dashboard `abf78fb`, seal-ui `2cccdb2`,
  token-deployer-ui `6aa9980`, treasury-ui `e92b804`, walrus-relay `112d0d3`, walrus-ui `86a7242`.
- **Clean under the shipped rules.** `npx eslint .` in each of the eight, with `@meddleware/eslint-config`
  0.0.2 installed (2026-10-09): exit 0.
- **Not adopted:** `landing` (named in CLAUDE.md) and `ui` (F13). The `--if-present` masking in consumer CI
  is F14. CLAUDE.md's "take `^0.0.x`" is now true for the eight.

### F2 — The `files` option crashes ESLint or silently misplaces the template rule

**Severity:** Low   **Disposition:** RESOLVED
**Where (as found 2026-10-03):** `src/index.js:107-110`:
`files: files.filter((f) => f.includes('vue')).length ? ['src/**/*.vue'] : []`.

**Issue (probe-verified 2026-10-03):**

- **Crash.** `suiBoundary({ files: ['src/**/*.ts'] })`, a natural choice for a TS-only package, yields
  a config object with `files: []`. ESLint 10 then throws at config load:
  `Config "@meddleware/eslint-config/template-urls": Key "files": Expected value to be a non-empty
  array`.
- **Rule silently off.** `suiBoundary({ files: ['app/**/*.{ts,vue}'] })` applies the script rules to
  `app/A.vue`, but the template rule does **not** fire there. It does fire on `src/A.vue`, which the
  consumer excluded.
- The README's own example `['src/**/*.{ts,vue}']` works only because it happens to contain `vue`
  and use `src/`.

**Impact:**

- A consumer that customises `files` either breaks its lint step entirely (fail-loud: an
  availability problem, not a security one),
- or silently loses the URL rule where its components actually live (fail-open).

**Remediation / evidence:** RESOLVED in `0.0.2` (`5e959bf`).

- `vueGlobs(files)` (`src/index.js:167`) derives the `.vue` globs from `files` (`vueFiles` overrides
  them). `suiBoundary` emits the template config object only when `vueFiles.length` is non-zero (`:292`),
  so a TS-only `files` no longer reaches ESLint as `files: []`, and a non-`src` root keeps the rule where
  the components are.
- Tests (`tests/boundary.test.ts`): "does not crash on TS-only files and puts no template rule where
  there are no .vue globs", "applies the template rule where the consumer put its components, not only
  under src", "derives the .vue globs from the script globs". Re-probed 2026-10-09:
  `suiBoundary({ files: ['src/**/*.ts'] })` lints without a config error.

### F3 — "Append last" replaces the consumer's own restriction rules and disables core `no-restricted-imports`

**Severity:** Low   **Disposition:** RESOLVED (OQ2 decided)
**Where (as found 2026-10-03):** `src/index.js:101-105, 111-113`; README "Append it **last**, so its rule options are the
ones in force".

**Issue (probe-verified 2026-10-03):**

- ESLint flat config does not merge rule options: a later config's options **replace** earlier ones
  for matching files.
- The fragment sets `no-restricted-syntax`, `vue/no-restricted-syntax` and
  `@typescript-eslint/no-restricted-imports` outright, and sets core `no-restricted-imports` to
  `'off'`.
- Probe results for files under `src/`:
  - a consumer's `no-restricted-syntax: ['error', 'ForInStatement']` no longer reports a `for…in`;
  - a consumer's `no-restricted-imports: ['error', 'lodash']` no longer reports `import lodash`.
- The README presents "last wins" as the reason to append last. It does not warn that unrelated
  consumer restrictions are erased. No error or warning is emitted.

**Impact:**

- Latent: none of the eight consumers configure these rules today.
- The first consumer that adds a project-specific ban (for example a deprecated helper, or
  `localStorage` per walrus-client's `browserStorage()` invariant) loses it silently under `src/`.

**Remediation / evidence:** RESOLVED in `0.0.2` (`5e959bf`); decision on OQ2 recorded in the log.

- `extraSyntax`, `extraTemplateSyntax` and `extraImportPaths` are merged into the emitted
  `no-restricted-syntax`, `vue/no-restricted-syntax` and import-rule options (`src/index.js:243-244,
  258, 276, 288, 301`). The replacement semantics are the first thing the README states ("It replaces your
  own restriction rules"), and CLAUDE.md records it as an invariant.
- Core `no-restricted-imports` stays `'off'` for TS/Vue files (the typescript-eslint rule supersedes it);
  for plain `.js`/`.mjs`/`.cjs`/`.jsx` files the core rule is the one emitted (`splitGlobs`), so the
  TypeScript plugin need not be registered for them.
- Test: "keeps the consumer's own restrictions in force through the extra* options" (and "merges the
  consumer's template restrictions"). No consumer configures its own restriction rules today
  (`grep no-restricted */eslint.config.ts`: none).

### F4 — The script boundary is name-based and misses common variants and reads

**Severity:** Low   **Disposition:** RESOLVED (OQ1 decided; residual evasion forms are F12)
**Where (as found 2026-10-03):** `src/index.js:17, 34-55, 94-95`.

**Issue (each probe-verified as *not reported* under default options, 2026-10-03):**

| Category | Not caught |
| --- | --- |
| Call shape | `const { moveCall } = tx; moveCall()`; `tx['moveCall']()`; `tx.moveCall.bind(tx)`; `tx.add(…)` (raw `Commands`) |
| Transaction class | `Transaction.from(bytes)`; `new T2()` where `Transaction as T2` comes from any non-`@mysten/sui` module that re-exports it |
| Dynamic import | ``import(`@mysten/sui/grpc`)`` (a template literal has no `source.value`); `import('@mysten/sui/' + 'grpc')` |
| Unlisted Sui entry points | `@mysten/sui/graphql` (`SuiGraphQLClient` — full chain reads) and `@mysten/sui/faucet`; the restricted-path list names only `grpc`, `client`, `transactions` and `jsonRpc` |
| Unlisted reads | `core.listDynamicFields`, `getDynamicField`, `getBalance`, `listBalances`, `listCoins`, `getTransaction`, `simulateTransaction`, `executeTransaction`, `getCurrentSystemState`. **Live today:** `dao-ui` and `treasury-ui` `useTreasury.ts:20` (`getSuiClient().core.getBalance`) and `useEpoch.ts:12` (`getCurrentSystemState`). They pass the rule; whether they are in-bounds is OQ1. |
| File types | `src/**/*.{js,jsx,cjs,mjs,cts}` are outside the default `files` |

**Impact:**

- An honest mistake in an unlisted form, or an agent rewriting a flagged call to "fix lint", passes
  CI.
- Consumer audits that cite the boundary as an ADR-0001 control overstate it.

**Remediation / evidence:** RESOLVED in `0.0.2` (`5e959bf`).

- **Call shape.** `COMMANDS` are refused on any `MemberExpression` reference (`.bind`, `tx['moveCall']`
  via the computed selector), in `ObjectPattern > Property` (destructuring), and as calls
  (`src/index.js:62-64, 90-94`). `Transaction.from` and the other statics: `MemberExpression[object.name=
  'Transaction']` (`:89`). Generic names (`publish`, `upgrade`) stay call-only.
- **Dynamic import.** String, template-literal and concatenated `import()` sources, and `require()`, are
  refused (`importSyntax`, `:79-84`).
- **Entry points.** Every `@mysten/sui/*` subpath except `utils` and `bcs` is refused at runtime (type-only
  allowed), JSON-RPC even as a type: `ALLOWED_SUI_SUBPATHS`, `restrictedImportOptions` (`:24, 44-60`), so
  `graphql`, `faucet` and `cryptography` are covered. Re-probed 2026-10-09:
  `@mysten/sui/graphql` import reported.
- **Reads.** `listCoins`, `listDynamicFields`, `getDynamicField`, `getTransaction`, `simulateTransaction`
  and `executeTransaction` were added to `READS` (`:69-72`); computed access to any command or read name is
  refused. **OQ1 decided:** balance and epoch reads (`getBalance`, `listBalances`,
  `getCurrentSystemState`) are typed, domain-free queries and stay allowed (CHANGELOG 0.0.2 "Changed",
  CLAUDE.md "Allowed on purpose", README). dao-ui and treasury-ui still call
  `getSuiClient().core.getBalance` / `getCurrentSystemState` through their `wallet.ts` shim, which matches
  ADR-0001's "balance through the app's wallet.ts shim" and passes.
- **File types.** Default `files` is `src/**/*.{ts,mts,cts,tsx,js,mjs,cjs,jsx,vue}`; plain JS gets the
  core import rule (`splitGlobs`).
- **Tests.** "refuses a command by any reference, not only a call", "refuses static members of
  Transaction and computed access to the read methods", "refuses the reads and execution the first version
  missed", "allows the typed balance and epoch reads, and unrelated calls that share a generic name",
  "refuses dynamic imports built from a template literal or a concatenation", "refuses require() of the
  restricted paths and allows the utility subpaths", "refuses the entry points the first version did not
  list", "covers plain JavaScript files with the core import rule", "splits globs by extension".
- **Still not caught (name-based by design; README "What it cannot do", SECURITY.md):** see F12.

### F5 — The template URL rule misses sinks; the HTML half of VUE-M1 is unenforced

**Severity:** Low   **Disposition:** RESOLVED (helper trust by name is ADJUDICATED; residual forms are F12)
**Where (as found 2026-10-03):** `src/index.js:14-15` (`URL_ATTRIBUTES`), `:64-77` (`templateUrlRestrictions`).

**Issue — not reported under default options (2026-10-03):**

| Sink | Example | Note |
| --- | --- | --- |
| Object spread | `<a v-bind="{ href: url }">` | `key.argument` is null |
| Dynamic argument | `<a :[attr]="url">` | |
| Upper-case native tag | `<IMG :src="url">` | Fails the `rawName` regex. Vue's compiler does not treat `IMG` as a native tag and resolves it as a component; unresolved, `createElement('IMG')` yields an HTML `img`. Established by reading Vue's compiler, not run in a browser. |
| `:xlink:href` | `<svg><use>`, SVG `<a>` | Script-capable in SVG `<a>` |
| `:srcdoc` | `<iframe>` | HTML injection, not only a URL |
| `:ping` | `<a>` | |
| `:imagesrcset` | `<link>` | |
| `:content` | `<meta http-equiv="refresh">` | |
| `:style` | `{ backgroundImage: \`url(${x})\` }` | Tracking / exfiltration only in modern browsers |

Further limits:

- **Name-based helper trust.** A locally defined `const safeHref = (u) => u` satisfies the rule.
  `'javascript:…'` *literals* are accepted (author-controlled).
- **`v-html` is out of scope.** VUE-M1's other half is not covered by this package. The consumers use
  `pluginVue.configs['flat/essential']`, which lacks `vue/no-v-html` (only `flat/recommended` has it,
  as a warning). No consumer has a `v-html` today.

**Impact:** a future unsanitised sink in one of these forms passes CI. Consumer audits citing the
rule for VUE-M1 overstate it.

**Remediation / evidence:** RESOLVED in `0.0.2` (`5e959bf`).

- **Sinks.** `xlink:href`, `ping`, `imagesrcset` joined `URL_ATTRIBUTES` (`src/index.js:16-18`); bound
  `srcdoc` (`REFUSED_ATTRIBUTES`) and `<meta :content>` are refused outright; argument-less `v-bind` and
  dynamic `:[name]` arguments on native elements are refused; native tags match case-insensitively
  (`NATIVE`, `:26-31`, so `<IMG>` is covered); a `url(...)` in a bound `style` is refused
  (`:122-158`). A ternary whose branches are both safe is accepted.
- **HTML half of VUE-M1.** `'vue/no-v-html': 'error'` is emitted with the template config (`:303`), so
  every consumer that applies the boundary now refuses `v-html` on its `.vue` files, independent of the
  `flat/essential` preset.
- **Tests.** "refuses the extra URL attributes, srcdoc, meta content and v-html", "refuses argument-less
  v-bind and dynamic attribute names on native elements", "refuses an upper-case native tag", "refuses
  url() built in a bound style", "accepts a ternary whose branches are both safe, and refuses one with an
  unsafe branch", "keeps components and plain styles alone". Re-probed 2026-10-09: `<IMG :src>`,
  `v-bind="o"`, `:[attr]`, `v-html`, `:style` with `url()` all reported; `safeHref(u)` accepted.
- **Adjudicated:** helper trust stays by name (a local `safeHref = (u) => u` satisfies the rule) and a
  `javascript:` *literal* is accepted (author-controlled). Both are stated in the source comment, README
  and SECURITY.md.

### F6 — False positives from method-name-only selectors

**Severity:** Info   **Disposition:** RESOLVED (the two defects; name-only friction ADJUDICATED)
**Where (as found 2026-10-03):** `src/index.js:34-50, 67`.

**Issue:**

- `bus.publish('x')`, `ws.upgrade()`, `s3.getObject('k')` and similar unrelated calls are refused,
  because the selector keys on the method name alone. `publish`, `upgrade` and `getObject` are common
  names.
- `:href="cond ? safeHref(url) : undefined"` is refused (conservative).
- A `urlHelpers` entry containing `$` (allowed through by the sanitiser at `:65`) becomes a regex
  anchor, so the helper can never match. This fails closed.

**Impact:** friction that invites `eslint-disable` comments, which would then also hide real hits.

**Remediation / evidence:** RESOLVED for the two defects in `0.0.2` (`5e959bf`); the rest ADJUDICATED.

- **Ternary.** `ConditionalExpression` with two safe branches is accepted (`src/index.js:126-127`); test
  "accepts a ternary whose branches are both safe, and refuses one with an unsafe branch".
- **Regex characters in helper names.** `escapeName` (`:107-109`) strips non-identifier characters and
  escapes `$`, so the helper matches instead of silently never matching; test "escapes a helper name that
  contains a regular-expression character".
- **Adjudicated.** Method-name-only selectors cannot be narrowed to a `Transaction` receiver in esquery.
  `publish` / `upgrade` stay call-only; `getObject`, `getObjects` and the other reads still refuse
  same-named calls on unrelated objects (`bus.upgrade()`). README "What it cannot do" tells repositories
  to scope `files`, and recommends `--report-unused-disable-directives` and a reason on every disable. No
  consumer has needed an `eslint-disable` for these rules (all eight lint clean).

### F7 — The `wallet.ts` exemption is total

**Severity:** Info   **Disposition:** RESOLVED
**Where (as found 2026-10-03):** `src/index.js:95` (default `ignores`).

**Issue / Impact:**

- `src/wallet.ts` (top level only; a nested `src/lib/wallet.ts` is still checked — probe) is exempt
  from **every** boundary rule.
- The shim legitimately imports `@mysten/sui/grpc` types and the wallet-adapter. But a PTB built or an
  object read inside it is equally unchecked, and the file is the natural place for such drift.
- The tests exemption (`*.test.*`, `*.spec.*`, `__tests__`) is reasonable.

**Remediation / evidence:** RESOLVED in `0.0.2` (`5e959bf`). `walletFiles` (default `src/wallet.ts`) get
their own config object, `@meddleware/eslint-config/sui-boundary-wallet` (`src/index.js:280-291`): the
client imports are allowed, `walletRestrictions` (commands, reads, `Transaction`) are not. Test "lets the
wallet shim import the client but still refuses commands, reads and transactions". Re-probed 2026-10-09:
`new Transaction()` in `src/wallet.ts` is reported. The tests exemption is unchanged.

### F8 — CI, packaging and release details

**Severity:** Info   **Disposition:** RESOLVED (self-lint, tag signing and lowest-version tests ACCEPTED-RISK)
**Where (as found 2026-10-03):** `.github/workflows/npm-publish.yml:65-69, 90`; `package.json`.

**Issue / Impact:**

- **`--if-present` in verify.** The publish `verify` job runs type-check, test and build with
  `--if-present`, so a renamed script would skip silently. Node CI runs no build and no
  `npm pack --dry-run`.
- **No self-lint.** There is no ESLint config for the package's own source. It is small and
  `checkJs`-strict, so the risk is minimal.
- **No SECURITY.md**, and no reporting route in the README.
- **`sideEffects` not declared.** The module is pure; irrelevant for an ESLint config but costless to
  state.
- **Peer range.** `eslint ^10.0.0`; the plugins are undeclared by design. A consumer without the `vue`
  plugin fails loudly (fine). The consumer's plugin version decides the AST, and only one version
  pair is tested here (S3).
- **Unsigned lightweight tag** (`v0.0.1`).

**Remediation / evidence:** RESOLVED in `0.0.2` (`4946b9f`, `5e959bf`); residuals ACCEPTED-RISK.

- **Release gate equals CI.** `npm-publish.yml` `verify` job calls `./.github/workflows/node-ci.yml`
  (`workflow_call`), so the tag runs actionlint, `npm ci`, `npm audit --audit-level=high`, type-check, tests,
  build and a package-contents check on the tagged commit. No `--if-present` remains in either workflow.
  The package-contents step fails on a missing `src/index.js` / `dist/index.d.ts` / `package.json` or any
  file outside `src/`, `dist/`, `package.json`, LICENSE, README, CHANGELOG.
- **SECURITY.md** added (scope, "guard rail, not a sandbox", supply chain, supported versions, reporting
  to `security@meddleware.co.uk`, 3-business-day acknowledgement). **`sideEffects: false`** declared.
- **Dependabot.** `.github/dependabot.yml` (`4946b9f`): npm and github-actions, weekly, grouped
  (`npm-minor-patch`, `github-actions`). It produced `0a7ca84` (lockfile) on 2026-10-09.
- **ACCEPTED-RISK:** (a) no ESLint self-lint (`checkJs` + `strict`, 308-line module, 35 tests);
  (b) tags `v0.0.1` / `v0.0.2` are lightweight — the integrity control is the OIDC provenance attestation,
  which npm shows for both versions; (c) only one `typescript-eslint` / `eslint-plugin-vue` version pair
  is tested (S3), but all eight consumers lint clean on their own pairs.

### F9 — Documentation drift

**Severity:** Info   **Disposition:** RESOLVED (landing wording: F13)

*As found 2026-10-03:*

- CLAUDE.md "Release" says the consumers take `^0.0.x`; none does yet (F1).
- `CHANGELOG.md` `[0.0.1] - 2026-10-02` describes a release that is not on npm (F1).
- The README "Options" section does not say that `files` must include a `vue` glob, or that
  non-`src` roots lose the template rule (F2). It does not say that the fragment replaces consumer
  restriction rules (F3). It does not state the rule's limits (F4, F5).
- CLAUDE.md invariant "Every selector is proven by a fixture test … in both directions" holds for the
  selectors as written; the gaps are selectors that don't exist yet (F4, F5).

**Remediation / evidence:** RESOLVED in `0.0.2` (`5e959bf`). The README now opens with the replacement
semantics, documents `files` / `vueFiles` / `walletFiles` / `extra*`, lists exactly what each rule
refuses, and has a "What it cannot do" section; CLAUDE.md states the same invariants (replace-not-merge,
accidents-not-evasion, balance/epoch allowed on purpose); CHANGELOG `[0.0.1]` describes a release that is
on npm; consumers take `^0.0.2`. One drift remains: CLAUDE.md names `landing` as a consumer, but it does
not apply the boundary (F13).

### F10 — Positive: two-way fixture tests with the consumers' parsers; strict, dependency-free package

**Severity:** Positive

- **Tests (35 at 2026-10-09, up from 12).** Every selector has a reported and an allowed fixture (`tests/boundary.test.ts`), run
  through ESLint's `Linter` with `typescript-eslint` and `vue-eslint-parser` as the apps configure
  them. The fixtures include mixed imports, optional-call reads, the SFC script, the exempt paths,
  helper-wrapped and static bindings, and components.
- **Import rules.** `allowTypeImports` keeps type-only imports usable. JSON-RPC is refused even as a
  type. Re-exports and `export *` are refused (probe).
- **Template rule.** It keys on native elements only (components sanitise their own props). It
  catches `v-bind:`, `.prop` and upper-case attribute names (probe). `urlHelpers` are stripped to
  identifier characters before entering a selector.
- **Package.** Exported constants are frozen. `checkJs` + `strict`. Declarations are built for
  consumers. No runtime dependencies and no install-time scripts beyond `prepublishOnly` (B.TS-2). A
  six-file tarball (0.0.2: 9.1 kB packed, 31.2 kB unpacked).

### F11 — Positive: ready to adopt (now adopted); the component exemption's premise holds in `@meddleware/ui`

**Severity:** Positive

- **Consumer runs.** First pass: a sweep over 123 TS/Vue files in the eight consumers reported **zero**
  violations. 2026-10-09: the real lint step, `npx eslint .` with `@meddleware/eslint-config` 0.0.2
  installed, exits 0 in access-gate-ui, dao-ui, dashboard, seal-ui, token-deployer-ui, treasury-ui,
  walrus-relay and walrus-ui. The B8 refactor already moved PTBs and object/event reads into the domain
  clients, and every native URL binding goes through `safeHref`, `safeIcon`, `suiExplorerUrl` or
  `walruscanBlobUrl`.
- **`@meddleware/ui` components.** `ExplorerLink`, `AppFooter` and `StatusWidget` bind `href` through
  `safeHref`. `CopyrightLine` binds through `computedSymbolHref`, built from a local `symbolLink`
  (root-relative paths, else `safeHref`) and fixed `/legal/` paths.
  - The exemption is therefore sound in practice.
  - It is not machine-checked, because `ui` does not run the template rule, and `computedSymbolHref`
    would not satisfy it as written (S2, F13).
- **Release chain.** SHA-pinned actions (`checkout@3d3c42e…`, `setup-node@8207627…`); actionlint by
  digest; least privilege (`id-token: write` only on publish); tag = version; idempotent OIDC
  `--provenance` publish; npm client pinned (11.20.0); release gate = CI (F8).

### F12 — Residual evasion forms remain by design

**Severity:** Info   **Disposition:** ACCEPTED-RISK
**Where:** `src/index.js:62-95, 122-158`; README "What it cannot do"; SECURITY.md "What the rules
guarantee".

**Issue (probe-verified 2026-10-09 against `0.0.2`; each is *not reported*):**

- `tx.add(…)` (raw `Commands`), and a command or read reached without its own name, e.g. a wrapper.
- `new T2()` where `Transaction as T2` comes from a non-`@mysten/sui` module that re-exports it.
- A destructured read: `const { getObject } = c; getObject()` (destructuring is refused for the
  *commands*, not the reads; computed access to reads is refused).
- A bound `:innerHTML.prop` (or other markup-valued DOM property) on a native element; the template
  rule covers URL attributes, `srcdoc`, `<meta content>` and `url()` in `style`, plus `v-html`.
- A locally defined helper named like a trusted one, and `javascript:` literals (F5, adjudicated).
- An `eslint-disable` comment.

**Impact:** a determined or careless author, or an agent rewording a flagged call, can pass CI in these
forms. Consumer audits that cite the boundary as a control must not call it complete. The exposure is
future drift: today's consumers lint clean and no such form exists in them.

**Remediation / evidence:** ACCEPTED-RISK. A name-based selector cannot follow values through arbitrary
re-exports or helpers, and a wider net would add false positives (F6). The limit is stated in the source
header, README, CLAUDE.md invariant ("The rules catch accidents, not evasion") and SECURITY.md; review stays
the control. Revisit if the `strictBoundary()` variant (S4) or a corpus test (S1) is built.

### F13 — `landing` and `ui` do not apply the boundary

**Severity:** Info   **Disposition:** DEFERRED (pre-mainnet gate: "`ui` runs the template rule", Section D)
**Where:** `landing/eslint.config.ts`, `ui/eslint.config.ts` (no `@meddleware/eslint-config`);
`eslint-config/CLAUDE.md` "Release".

**Issue:**

- CLAUDE.md lists `landing` among the consumers that "take `^0.0.x`"; `landing` has no dependency on the
  package and no `suiBoundary()`. It has no `@mysten/*` import and one native URL binding, in
  `ToolCard.vue`, through `safeHref`, so no chain boundary is at risk there.
- `@meddleware/ui` (a component library, exempt by design from the template rule) does not run the
  template rule on its own components either (S2). Its five `href` bindings are sanitised today
  (F11).

**Impact:** the component exemption in the template rule is relied on but not machine-checked; a future
unsanitised binding in `ui` or `landing` passes. Low: both are small, and the premise holds today.

**Remediation / evidence:** DEFERRED to the pre-mainnet gate in Section D (`ui` applies
`templateUrlRestrictions([...URL_HELPERS, 'symbolLink'])` or inlines the binding, S2; `landing` either
adopts `suiBoundary()` or CLAUDE.md drops it from the consumer list). Maintainer decision on which; not
required for the testnet apps.

### F14 — Consumer CI runs `lint:js` with `--if-present`

**Severity:** Low   **Disposition:** DEFERRED (pre-mainnet gate: consumer CI, Section D)
**Where:** `node-ci.yml` in access-gate-ui (`:39`), dao-ui (`:39`), dashboard (`:42`), seal-ui (`:39`),
token-deployer-ui (`:39`), treasury-ui (`:39`), walrus-relay (`:35`), walrus-ui (`:39`): `npm run lint:js
--if-present`.

**Issue:** the boundary is now in force in the eight consumers, but their CI step skips silently if
`lint:js` is renamed or removed. All eight define `"lint:js": "eslint ."` today, so the step runs. The
same pattern was F8 here (fixed). Their release workflows run the same CI.

**Impact:** a future script rename would drop the boundary (and every other ESLint rule) without a CI
signal.

**Remediation / evidence:** DEFERRED: remove `--if-present` from the lint step in each consumer (a
one-line change per repo); pre-mainnet gate in Section D. Not
fixed here because the consumers are separate repositories.

---

## Section A — Invariant verification matrix

| # | Invariant | Enforced at | Proven by | Status |
| --- | --- | --- | --- | --- |
| A1 | No runtime import of any `@mysten/sui/*` subpath except `utils` and `bcs` in app `src/`; type-only allowed | `restrictedImportOptions` | fixtures ("refuses the entry points…", "allows the utility subpaths…"); probe `graphql` 2026-10-09 | HOLDS |
| A2 | No JSON-RPC, even type-only | same (`paths` entry; excluded from the pattern) | fixture | HOLDS |
| A3 | No transaction building in app code | `scriptRestrictions` (`chainSyntax`, `importSyntax`) | fixtures; name-based, residual forms accepted (F12) | HOLDS |
| A4 | No chain object or event reads in app code (balance and epoch reads allowed on purpose, OQ1) | `scriptRestrictions` (`READS`) | fixtures | HOLDS (F4; residual F12) |
| A5 | Native-element URL bindings are literals or helper calls (VUE-M1, URL half) | `templateUrlRestrictions` | fixtures | HOLDS (F5; helper trust by name, F12) |
| A6 | No `v-html` (VUE-M1, HTML half) | `vue/no-v-html: 'error'` in the template config | fixture | HOLDS (F5) |
| A7 | Options compose safely with the consumer's config | `suiBoundary`, `vueGlobs`, `splitGlobs`, `extra*` | fixtures ("options" group) | HOLDS (F2, F3) |
| A8 | Every selector proven in both directions | tests | 35/35 | HOLDS |
| A9 | No runtime dependencies or plugins declared | `package.json` | inspection | HOLDS |
| A10 | The boundary is in force in every adopting consumer | consumers' `eslint.config.ts` (`...suiBoundary()` last) | `eslint .` exit 0 in all eight, 2026-10-09 | HOLDS (F1). Not in `landing`, `ui` (F13); CI masking F14 |
| A11 | The tag ships only what CI accepts | `npm-publish.yml` `verify` → `node-ci.yml` | workflow; registry provenance | HOLDS (F8) |

---

## Section B — Supply-chain, publish-authority & capability matrix

### B.1 Dependency & CVE risk

`npm audit --audit-level=high`: 0 (2026-10-09). All dependencies are dev-only. The consumer's
installed ESLint and plugins run at lint time (liveness: none; an unavailable registry only blocks
installs, and fails closed).

| Dependency | Range (installed) | Role | Status |
| --- | --- | --- | --- |
| `eslint` | peer `^10.0.0`; dev `^10.11.0` (10.11.0) | host | clean |
| `typescript-eslint` | dev `^8.70.1` (8.71.0) | tests (parser and plugin) | clean |
| `eslint-plugin-vue` / `vue-eslint-parser` | dev `^10.11.1` / `^10.4.1` | tests | clean |
| `typescript` / `vitest` / `@types/node` | dev `~6.0.3` / `~5.0.2` / `~24.12.2` (6.0.3 / 5.0.3 / 24.12.4) | build / tests | clean. TypeScript 7 and Node 25 / `@types/node` 26 were declined in the 2026-10-09 Dependabot triage (Node 24 LTS only; TypeScript 7 deferred) |

First-party range: consumers pin `^0.0.2`, which resolves to exactly 0.0.2 (workspace policy).

### B.2 Publish authority & CI

| Authority | Where | Custody | Gates |
| --- | --- | --- | --- |
| npm publish `@meddleware/eslint-config` | `npm-publish.yml` (tag `v*`) | OIDC trusted publishing; `--provenance` | releases. `0.0.1` and `0.0.2` published and attested |
| `0.0.0` placeholder | manual publish 2026-10-02 | maintainer | no provenance (expected for a placeholder); deprecated 2026-10-09 |

#### CI & release integrity

| Item | Holds? | Evidence |
| --- | --- | --- |
| Actions pinned to SHAs | Yes | `checkout@3d3c42e…`, `setup-node@8207627…`; actionlint image by digest |
| Least privilege | Yes | `contents: read`; `id-token: write` on the publish job only |
| `npm ci` + audit in CI and publish | Yes | `node-ci.yml`, reused by the tag workflow |
| Publish npm client pinned | Yes | `npm@11.20.0` |
| Tag ↔ version check | Yes | publish step |
| OIDC trusted publishing, no long-lived token | Yes | `id-token: write`; registry shows provenance for 0.0.1 and 0.0.2 |
| Idempotent publish | Yes | registry 200 check, conflict treated as success |
| Release gate equals CI | Yes | `verify` calls `node-ci.yml` (`workflow_call`) (F8) |
| Verify without `--if-present` | Yes | F8 |
| Build and pack checked in CI | Yes | `Build`, `Package contents` steps |
| Automated dependency updates | Yes | `.github/dependabot.yml` (npm, github-actions; weekly, grouped); merged `0a7ca84` |
| Secrets never echoed / real funds / test-only modes | N/A | no secrets, no chain, no test mode |

### B.TS-1 Packaging

| Check | Result |
| --- | --- |
| `exports` / `types` | `.` → `types: ./dist/index.d.ts`, `default: ./src/index.js`; declarations built from the JSDoc types |
| `files` | `src`, `dist`, `CHANGELOG.md` (+ README, LICENSE, package.json); no tests or config shipped; CI fails on stray files |
| `sideEffects` | `false` (module is pure; F8) |
| Ships-source | ships JS + `.d.ts`, so consumer `tsc` sees only declarations |

### B.TS-2 Install-time code

| Script | Purpose |
| --- | --- |
| `prepublishOnly` → `npm run build` | emit `dist/index.d.ts` before publish |

No `preinstall`, `install`, `postinstall` or `prepare` scripts; no `overrides`.

### B.TS-3 Supply-chain gates

Lockfile committed; `npm ci` everywhere; audit at `high` in CI (and so in publish, which calls it), with no
allowlist needed; publish npm client pinned. Holds.

---

## Section C — Test-coverage & hermetic/live split

### C.1 Coverage grade — A (35/35 at 2026-10-09; both directions per selector; options, evasion variants and merge cases covered)

| Dimension | Assessment |
| --- | --- |
| Happy path | Type-only imports; domain-client calls; helper and static bindings; components; exempt paths; balance and epoch reads; utility subpaths |
| Error path | Runtime and mixed imports; JSON-RPC types; dynamic and `require()` imports; `new Transaction` and statics; commands by any reference; reads; the unlisted entry points; unsafe bindings and every template sink in F5; Vue SFC script |
| Boundary | `files` and `ignores` options; TS-only globs; non-`src` roots; `extra*` merging; wallet shim; plain-JS files; glob splitting. Not covered: other file extensions beyond the defaults, the residual forms in F12 (by design) |
| Security-relevant | Each listed selector is proven. The *completeness* of the lists is not tested; a corpus test (S1) or a scheduled consumer lint against HEAD would catch drift both ways |

**Test layers:**

| Layer | Files | In CI? |
| --- | --- | --- |
| Fixture unit tests | `tests/boundary.test.ts` (35) | yes |
| Consumer lint (real configs against `src/`) | each consumer's own `lint:js` | yes, in the consumers' CI (with `--if-present`, F14) |

### C.2 Hermetic vs. live paths

Everything in this package is hermetic: there is no network and no chain. The only "live" dimension is
consumer adoption (F1, F13, F14) and the consumers' plugin versions (S3).

---

## Section D — Deployment-readiness gates

*(For a lint package: "testnet" and "mainnet" mean the consumers' gates. The package should be in
force before consumers claim ADR-0001 / VUE-M1 enforcement.)*

### pre-localnet (before adoption)

- [x] fixture tests in both directions; strict type-check; no runtime dependencies — F10
- [x] all consumers pass under the default options — F11 (`eslint .` exit 0 in the eight, 2026-10-09)
- [x] `files` handling fixed (no crash; template globs follow `files`) — F2, `0.0.2` `5e959bf`
- [x] consumer restriction rules merged, not replaced — F3, `extra*` options and test

### pre-testnet *(consumers are live on testnet; unmet items are retroactive)*

- [x] published with provenance and applied in all eight consumers — F1 (npm `0.0.2`, attested; consumer commits of 2026-10-08)
- [x] Sui entry points, read list and evasion forms decided and covered — F4, OQ1 decided; residual forms accepted (F12)
- [x] template sinks and `vue/no-v-html` covered — F5
- [x] `SECURITY.md` present; Dependabot configured; release gate equals CI — F8

### pre-mainnet

- [ ] consumer CI runs `lint:js` without `--if-present`, with the boundary present — F14 (consumer repos; mainnet gate)
- [ ] `ui` runs the template rule on its own components; `landing` adopts or leaves the consumer list — F13, S2 (maintainer decision)
- [ ] external review — maintainer item (mainnet gate)

---

## Cross-project themes

- **Consumer audits must not over-credit this package.**
  - The boundary is now in force in eight consumers (F1), but it stays name-based (F12).
  - Consumer audits should cite this audit's A3–A6 status and the "accidents, not evasion" limit rather
    than "enforced by `@meddleware/eslint-config`".
- **Direct reads in dao-ui and treasury-ui.** `getBalance` and `getCurrentSystemState` through the app's
  `wallet.ts` `getSuiClient()` pass the rule on purpose (OQ1 decided; allowed list in README, CLAUDE.md
  and CHANGELOG 0.0.2, matching ADR-0001's "balance through the app's wallet.ts shim").
- **`--if-present` in consumer CI.** All eight consumers run `npm run lint:js --if-present` (F14). The
  same pattern was F8 here and is fixed here; the consumer repos still carry it.
- **Component exemption ↔ `@meddleware/ui`.** The template rule trusts components. `ui` should run the
  template rule itself, with `urlHelpers: ['symbolLink']` or with the binding inlined (S2, F13).
- **Supply chain & release integrity.** Lockfile committed; actions SHA-pinned; OIDC provenance on every
  published version since 0.0.1; Dependabot grouped weekly; CVE audit clean (0) at 2026-10-09.
- **Wire-format coupling / on-chain-truth boundary / chain-access layering.** N/A as a producer: the
  package holds no wire format, ID or ABI and decides nothing on chain. It mechanises ADR-0001 for
  consumers; its allowed-list decisions (`utils`, `bcs`, balance and epoch reads) are ADR notes, not
  accounting.
- **Pre-v0.2 policy:** changes to the emitted config ship as patch releases without shims (0.0.2 did);
  consumers take them in one bump (`^0.0.2` resolves to exactly 0.0.2).

---

## Normative requirements (MUST / MUST NOT)

1. MUST be published with provenance and applied in every consumer before ADR-0001 or VUE-M1
   enforcement is claimed — **holds** for the eight adopting consumers (F1); `landing` and `ui` are
   outside it (F13).
2. MUST NOT crash or silently drop a rule for any documented option value — **holds** (F2).
3. MUST NOT silently discard a consumer's own restriction rules — **holds** through `extra*`; the
   replacement semantics are documented first in the README (F3).
4. MUST cover every `@mysten/sui` runtime entry point that reaches the chain, and every native
   URL/HTML sink listed in F5, or document each exclusion — **holds**; exclusions (`utils`, `bcs`, balance
   and epoch reads, helper trust by name, residual forms) are documented (F4, F5, F12).
5. MUST prove every selector in both directions with a fixture — holds (A8, 35/35).
6. MUST run the same checks on the tag as on `main` before publishing — holds (F8).
7. MUST keep consumer CI from silently skipping the lint step once the boundary is relied on — **does not
   hold** (F14, pre-mainnet gate).

**TS lens baseline:**

| ID | Holds? | Evidence |
| --- | --- | --- |
| TS-M1 | yes (`strict` + `checkJs`; no assertions; `noUncheckedIndexedAccess` off, no untrusted data parsed) | `tsconfig.json` |
| TS-M2 | yes (the only input is consumer config; helper names sanitised and escaped) | `index.js:107-109` |
| TS-M3 | N/A | — |
| TS-M4 | N/A (synchronous) | — |
| TS-M5 | N/A (no network) | — |
| TS-M6 | yes (no logging, no dynamic code) | — |
| TS-M7 | yes | B.TS-1, B.TS-2 |
| TS-M8 | yes | B.TS-3; Dependabot |
| TS-M9 | N/A (no `@mysten/*` dependency; declarations shipped) | `dist/index.d.ts` |

**VUE-M1 (as mechanised for consumers):**

| Half | Status | Finding |
| --- | --- | --- |
| URL sinks | enforced on native elements (helper trust by name) | F5, F12 |
| HTML (`v-html`) | enforced (`vue/no-v-html`) | F5 |
| Components (`ui`) | exempt; not machine-checked | F13 |

## Implementation suggestions (SHOULD / MAY)

- **S1** SHOULD add a corpus test: a fixtures directory of "must refuse" and "must allow" snippets. A
  scheduled job MAY also lint the consumers' `src/` with the unpublished HEAD to catch drift both ways.
  (Partly met: the 35 fixtures cover the F4/F5 cases; no scheduled consumer job.)
- **S2** SHOULD have `@meddleware/ui` apply `templateUrlRestrictions([...URL_HELPERS, 'symbolLink'])`
  to its own components, so the component exemption is machine-checked where it is relied on (F13).
- **S3** MAY test against both the lowest and the latest supported `typescript-eslint` and
  `eslint-plugin-vue`, since the consumer's versions decide AST shapes.
- **S4** MAY export a `strictBoundary()` variant with receiver-aware selectors (F12), and keep
  `suiBoundary()` as the low-noise default.
- **S5** MAY sign release tags (F8 residual); npm provenance is the current control.

## Open questions (`OQ#`)

1. **OQ1** F4: does ADR-0001 cover *all* chain reads? That includes balances, the system state or
   epoch, and dynamic fields, which dao-ui and treasury-ui read directly today. Or does it cover only
   object and event reads that need paging, type checks and BCS validation? The answer fixes the read
   list. (Decided 2026-10-08: balance and epoch reads are allowed on purpose, dynamic-field reads are
   refused — CHANGELOG 0.0.2, CLAUDE.md "Allowed on purpose"; see F4.)
2. **OQ2** F3: should consumers pass their own restrictions through options that the fragment merges,
   or should the fragment stop owning whole rules (for example by emitting its selectors under a
   dedicated rule via a tiny local plugin)? The latter would add a plugin, against the "no plugins
   declared" invariant. (Decided 2026-10-08: `extra*` options, no plugin — `0.0.2`; see F3.)
3. **OQ3** F1: why did `v0.0.1` not publish? Check the Actions log and the trusted-publisher binding
   before tagging 0.0.2. (Decided 2026-10-09: no further action — `0.0.1` and `0.0.2` are both on npm with
   provenance; the cause of the first failed attempt was not recorded; see F1.)

## Risks

- **False assurance:** consumer audits and CLAUDE.md files treating the boundary as complete (F12) rather
  than as an accident-catcher.
- **Evasion by agents:** coding agents that meet a lint error may rewrite to a form still unflagged
  (F12). Review must still look for chain access in app code.
- **Plugin drift:** consumers bring their own parser and plugin versions; an AST change can make a
  selector silently stop matching (S3).
- **Masked lint step:** a renamed or removed `lint:js` drops the boundary silently (F14).
- **Supply chain:** a compromised release would weaken the rules in every consumer's lint run. Controls:
  OIDC provenance and the tag gate; custody of the npm trusted-publisher binding and external review are
  maintainer items.

---

## Re-verification log

- 2026-10-03 — first-pass baseline at `0f2ee0d` (tag `v0.0.1` = `336c566`; npm `0.0.0` only).
  - **Lenses:** AUDIT_TEMPLATE.md (2026-10-02) + TS (2026-10-03). The template rule was assessed
    against VUE-M1.
  - **Measured:** 12/12 tests; type-check and audit (0) clean; build OK; pack 6 files, 4.4 kB.
  - **Probes:** 48 scratch cases confirmed F2–F6 and the positives in F10. A consumer sweep (123
    files, 0 violations) confirmed F11. Both were deleted afterwards.
  - **Not read:** Actions run history (unattached repo).
  - **Recorded:** F1–F11; OQ1–OQ3.
  - **No findings resolved:** by maintainer instruction this pass only records findings. Remediation,
    including single-solution fixes under the resolve-inline rule, is to be applied separately, with
    each disposition moved to RESOLVED and the diff cited.
- 2026-10-09 — alignment with `main` (HEAD `0a7ca84`; `v0.0.2` = `5e959bf`; npm `0.0.2` latest).
  - **Lenses:** AUDIT_TEMPLATE.md and AUDIT_TEMPLATE_TS.md, both 2026-10-08. Other lenses re-checked and
    still not triggered (no Move, chain access, Vue app, image or credentials).
  - **Resolved:** F1 (0.0.1 and 0.0.2 published with provenance 2026-10-08; eight consumers adopt
    `^0.0.2`, `eslint .` exit 0 in each; `0.0.0` deprecated 2026-10-09), F2, F3, F4, F5, F6, F7, F8, F9 in
    `0.0.2` (`5e959bf`, `4946b9f`), each with the pinning tests.
  - **Added:** F12 (residual evasion forms, ACCEPTED-RISK; probe-verified), F13 (`landing`, `ui` outside
    the boundary; DEFERRED to the pre-mainnet gate), F14 (consumer CI `--if-present`; DEFERRED to the
    pre-mainnet gate).
  - **Decisions recorded:** OQ1 (balance and epoch reads allowed on purpose; 0.0.2), OQ2 (`extra*`
    options, no plugin; 0.0.2), OQ3 (closed by publication; cause of the first failure not recorded).
  - **Re-measured:** 35/35 tests, type-check clean, audit 0, pack 6 files 9.1 kB (31.2 kB unpacked);
    CI pinned and reused by the tag workflow; Dependabot present (`0a7ca84` lockfile merge, not released).
  - **Corrected:** template dates (2026-10-08), deployment status, consumer list, Section A (A1–A10 now
    HOLDS, A11 added), Section D (pre-localnet and pre-testnet ticked), B.1/B.2 tables.
  - **Not verified:** the Actions run history (not read; npm timestamps and attestations used instead).
  - **Open for mainnet:** F13, F14, external review.

## Pre-save consistency checklist (this pass)

- [x] Section A ↔ findings: A1–A11 HOLDS with F1–F9 RESOLVED; A10 notes F13/F14.
- [x] Finding header ↔ body: dispositions updated; "as found" labels mark the first-pass text.
- [x] Template line: base + TS with registry dates (2026-10-08); untriggered lenses named; VUE-M1 assessment noted.
- [x] Closing four-part structure present.
- [x] Section D ↔ dispositions: unticked items cite F13, F14 and the external review.
- [x] Executive summary ↔ dispositions and ceiling (Medium; realised Low).
- [x] C.1 counts measured 2026-10-09 (35 tests).
- [x] Re-verification log entry added.
