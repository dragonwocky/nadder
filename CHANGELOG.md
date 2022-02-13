# Changelog

## v0.2.0 (wip)

### Added

- `markResponseForDownload(ctx)` helper.
- `useMiddleware` core extension (registers route-inspecific callbacks, always
  called _after_ any available route handlers).

### Changed

- Replaced the [Windi CSS](http://windicss.org/) engine with
  an [Uno CSS](https://github.com/unocss/unocss) engine.
- Restructured/restributed source code and exports into a more modularised form:
  route and middleware registration is handled by the `default` export,
  helpers are provided as named exports.

### Fixed

- JSX now handles `0` and `false` values properly.
- The `Session` interface is exported.

## v0.1.0 (2022-02-06)

Initial release.
