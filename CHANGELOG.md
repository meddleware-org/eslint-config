# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.1] - 2026-10-02

First release (B8).

### Added

- `suiBoundary(options)` — the chain-access boundary for app `src/`: restricted `@mysten/sui`
  imports (type-only allowed, JSON-RPC refused), transaction-building and chain-read calls, dynamic
  imports; plus the native-element URL-binding rule.
- Building blocks: `restrictedImportPaths`, `scriptRestrictions`, `templateUrlRestrictions`,
  `URL_HELPERS`, `URL_ATTRIBUTES`.
