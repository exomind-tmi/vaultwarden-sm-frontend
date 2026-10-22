# vaultwarden-sm-frontend

An **overlay build** of the Bitwarden OSS web vault that adds a clean-room **Secrets Manager**
module, served alongside a companion [vaultwarden](https://github.com/dani-garcia/vaultwarden) and
talking to the [`vaultwarden-sm`](../vaultwarden-sm) backend.

This repository is **not** a fork of `bitwarden/clients`. It vendors nothing from the upstream
monorepo: it keeps only the files we own — a clean-room SM Angular module plus a few thin patches —
and the build fetches a pinned upstream tag, lays our files on top, applies the patches, and
produces the static web-vault bundle. The licensed Bitwarden Secrets Manager (upstream
`bitwarden_license/`) is never used or copied; our module is written against open `@bitwarden/*`
libraries only.

## How it works (build)

```
upstream.json ── pinned bitwarden/clients tag
overlay/      ── new files copied verbatim onto the checkout (our SM module)
patches/      ── small git-apply patches for edits to existing upstream files (the /sm route)
scripts/      ── build orchestration
Dockerfile    ── bakes dist/ into a self-contained Caddy image (serve + API proxy)
Caddyfile     ── the serving + routing config for that image
```

`node scripts/build.mjs`: shallow-clone the pinned tag → copy `overlay/**` → `git apply`
`patches/*.patch` → `npm ci` → `npm run build:oss:selfhost:prod -w @bitwarden/web-vault` → collect
`apps/web/build` into `dist/`. CI then bakes `dist/` into the image. Node `>=24.17` + npm `~11`.

## Deployment

The build publishes one self-contained image, `ghcr.io/exomind-tmi/vaultwarden-sm-web`, that both
serves the web vault and reverse-proxies the API. Run it as a single service next to a companion
vaultwarden; **vaultwarden stays untouched** (a pure API backend, its own web vault can be
disabled). Point the ingress (Cloudflare Tunnel, nginx, …) at this service on port 80.

Caddy serves the static bundle from `/srv` and routes:

- `/sm-api/*` → the Secrets Manager backend (`$VAULTWARDEN_SM_URL`), prefix stripped — the backend
  sees its normal `/api` and `/identity`, so `bws` can use the same origin under `/sm-api`;
- `/api/*`, `/identity/*`, `/notifications/*`, `/icons/*`, `/attachments/*`, `/events/*` →
  vaultwarden (`$VAULTWARDEN_URL`);
- everything else → the static web vault (SPA, hash routing).

Minimal compose addition:

```yaml
services:
  vaultwarden-sm-web:
    image: ghcr.io/exomind-tmi/vaultwarden-sm-web:main
    container_name: vaultwarden-sm-web
    restart: unless-stopped
    pull_policy: always
    environment:
      VAULTWARDEN_URL: "http://vaultwarden:80"
      VAULTWARDEN_SM_URL: "http://vaultwarden-sm:8080"
    networks: [vaultwarden-network]
    depends_on: [vaultwarden]
```

Then point the tunnel's public hostname at `http://vaultwarden-sm-web:80`.

## Status

Scaffold + CI. The overlay builds in CI (pinned `web-v2026.10.0` + our `/sm` route + a placeholder
page) and publishes the self-contained Caddy image. Next: a live deploy test of the placeholder,
then the real Secrets Manager screens (Projects first) against the `vaultwarden-sm` backend over
`/sm-api`.

## License

Builds on `bitwarden/clients` (GPL-3.0). Unofficial; not affiliated with or endorsed by Bitwarden or
vaultwarden.
