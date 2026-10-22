# Tiny carrier image for the built web-vault bundle. It owns no logic beyond staging the static
# files: on start it copies /dist into the mounted /target (the shared folder vaultwarden serves as
# WEB_VAULT_FOLDER), then exits. Run as a one-shot init service; see README for the compose wiring.
FROM alpine:3.21
COPY dist /dist
CMD ["sh", "-c", "rm -rf /target/* && cp -a /dist/. /target/ && echo 'vaultwarden-sm: web vault staged into /target'"]
