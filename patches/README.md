# Patches

Thin, version-pinned patches applied to the upstream `bitwarden/clients` checkout after the
`overlay/` files are copied in. Everything that cannot be expressed as a *new* file (i.e. edits to
existing upstream files) lives here. Keep them as small as possible.

Applied in sorted order by `scripts/build.mjs` via `git apply` against `.build/clients`.

## Expected patches

- `0001-register-sm-route.patch` — registers the lazy `/sm` route in
  `apps/web/src/app/oss-routing.module.ts`, inside the authenticated `UserLayoutComponent` block
  (siblings: `vault`, `reports`), pointing at our overlaid
  `./secrets-manager-vw/sm-home.component#SmHomeComponent`. (Not yet generated — created and
  verified against the pinned tag in the first real pipeline run.)
- *(later)* a nav-visibility patch if the Secrets Manager product-switcher entry must appear
  without relying on vaultwarden reporting `canAccessSecretsManager` (our backend reports it false).

## Regenerating a patch when the pin moves

1. `node scripts/build.mjs --fetch-only` to get a clean checkout at the new `upstream.json` ref.
2. Edit the file(s) under `.build/clients/` by hand.
3. From `.build/clients`, capture the diff of just those files:
   `git diff -- apps/web/src/app/oss-routing.module.ts > ../../patches/0001-register-sm-route.patch`
4. Re-run `--fetch-only` to confirm the patch applies cleanly on a fresh checkout.
