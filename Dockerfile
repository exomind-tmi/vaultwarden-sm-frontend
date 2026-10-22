# Self-contained web-vault front: Caddy serves our static bundle and reverse-proxies the API,
# splitting Secrets Manager calls to the vaultwarden-sm backend from base calls to vaultwarden.
# Configured by two env vars (VAULTWARDEN_URL, VAULTWARDEN_SM_URL); vaultwarden itself stays untouched.
FROM caddy:2-alpine
COPY Caddyfile /etc/caddy/Caddyfile
COPY dist /srv
