# Security Policy

## Scope

This policy covers `@meddleware/eslint-config`: flat-config fragments that enforce the chain-access
boundary (workspace ADR-0001) and sanitised URL bindings in Vue templates. It has no runtime
dependencies and performs no network or file access; it runs only inside a consumer's ESLint.

It does not cover a consuming application, or ESLint and its plugins.

## What the rules guarantee

They are a **guard rail, not a sandbox**. The selectors are name-based, so they catch accidents and
shortcuts (including an agent rewording a flagged call to get past lint), not deliberate evasion: a value
passed through an arbitrary re-export, a locally defined `safeHref = (u) => u`, or an `eslint-disable`
comment defeats them. Anything citing the boundary as a control must say so, and keep review in place.

## Supply chain

Releases are published from this repository's `npm-publish.yml` with npm trusted publishing (OIDC and
provenance); tokens are not used. A compromised release could weaken the rules in every consumer's lint run,
so report anything that suggests tampering.

## Supported versions

Only the latest published npm version receives fixes.

## Reporting a vulnerability

Please **do not** open a public GitHub issue for security vulnerabilities.

Report vulnerabilities by emailing **<security@meddleware.co.uk>**. Include a description and impact, steps
to reproduce (a fixture that the rules wrongly accept is ideal), and the package version. You will receive an
acknowledgement within **3 business days**.
