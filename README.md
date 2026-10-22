# vaultwarden-sm-frontend

An **overlay build** of the Bitwarden OSS web vault that adds a clean-room **Secrets Manager**
module, served by a companion [vaultwarden](https://github.com/dani-garcia/vaultwarden) instance and
talking to the [`vaultwarden-sm`](../vaultwarden-sm) backend.

This repository is **not** a fork of `bitwarden/clients`. It vendors nothing from the upstream
monorepo. Instead it keeps only the files we own — a clean-room SM Angular module plus a handful of
thin patches — and the build fetches a pinned upstream tag, lays our files on top, applies the
patches, and produces the static web-vault bundle.

The licensed Bitwarden Secrets Manager (under `bitwarden_license/` upstream) is **never** used or
copied. Our module is written against open `@bitwarden/*` libraries only (`common`, `components`,
`angular`, `key-management`, `legacy-crypto`, `ui`), mirroring the same crypto pattern the backend
is byte-compatible with (org key from `KeyService.orgKeys$`, `EncryptService.encryptString`).

## How it works

```
upstream.json ── pinned bitwarden/clients tag (must support the "vfo1-foundation" client flag)
overlay/      ── new files copied verbatim onto the checkout (our SM module lives here)
patches/      ── small git-apply patches for edits to existing upstream files (e.g. the /sm route)
scripts/      ── build orchestration
dist/         ── output: the static web-vault bundle (→ vaultwarden WEB_VAULT_FOLDER)
```

`node scripts/build.mjs`:

1. **fetch** — shallow-clone the pinned `bitwarden/clients` tag into `.build/clients`.
2. **overlay** — copy `overlay/**` onto the checkout (preserving paths).
3. **patch** — `git apply` every `patches/*.patch` in order.
4. **build** — `npm ci` then `npm run build:oss:selfhost:prod -w @bitwarden/web-vault`
   (`ENV=selfhosted NODE_ENV=production`), emitting to `apps/web/build`.
5. **collect** — copy that bundle into `dist/`.

`npm run fetch` stops after step 3 (useful for authoring/refreshing patches); `npm run clean`
removes `.build/` and `dist/`.

### Requirements

Node `>=24.17.0` and npm `~11` (the upstream engine constraints), plus `git`. The full install +
build is heavy (the upstream monorepo), so it is meant for CI or a dev machine, not the NAS.

## Deployment

The built `dist/` is a path-agnostic static bundle (hash routing, no `<base href>`). Mount it into
the companion vaultwarden as its web vault:

- `WEB_VAULT_FOLDER=/path/to/dist` (and `WEB_VAULT_ENABLED=true`).

Secrets Manager API calls go to the `vaultwarden-sm` backend; user authentication rides the existing
vaultwarden session (no separate login). Routing/topology between the two is handled at the edge —
see the `vaultwarden-sm` project notes.

## Status

Scaffold only. The pipeline shape, pinned tag, overlay layout, and a placeholder `/sm` page are in
place. The `/sm` route patch and the real SM screens land next.

## License

Builds on `bitwarden/clients` (GPL-3.0). Unofficial; not affiliated with or endorsed by Bitwarden or
vaultwarden.
