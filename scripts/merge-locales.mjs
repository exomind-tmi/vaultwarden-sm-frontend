// Merge our own UI strings (locales/<lang>/messages.json) into the web vault's locale files.
//
// The web vault already ships the Secrets Manager strings with translations, so the overlay reuses
// those keys; this adds only the few strings it has no key for. Keys are additive: a key that
// already exists upstream fails the merge instead of silently overriding a translation. Languages
// without our file fall back to English, as the web vault's I18nService does for any missing key.
//
// Usage: node scripts/merge-locales.mjs <bitwarden/clients checkout>

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const OURS = resolve(dirname(fileURLToPath(import.meta.url)), "../locales");

export function mergeLocales(clientsRoot) {
  const upstreamDir = resolve(clientsRoot, "apps/web/src/locales");
  for (const lang of readdirSync(OURS)) {
    const target = resolve(upstreamDir, lang, "messages.json");
    if (!existsSync(target)) {
      throw new Error(`locales/${lang}: the web vault has no such locale`);
    }
    const text = readFileSync(target, "utf8");
    const upstream = JSON.parse(text);
    const ours = JSON.parse(readFileSync(resolve(OURS, lang, "messages.json"), "utf8"));
    const clash = Object.keys(ours).filter((k) => k in upstream);
    if (clash.length > 0) {
      throw new Error(`locales/${lang}: keys already defined upstream: ${clash.join(", ")}`);
    }
    // Append before the closing brace rather than re-serializing, so the upstream file stays
    // byte-for-byte as shipped (it has duplicate keys that a parse/stringify round-trip would drop).
    const entries = JSON.stringify(ours, null, 2).slice(1, -2); // the object body, no braces
    const end = text.lastIndexOf("}");
    writeFileSync(target, text.slice(0, end).trimEnd() + "," + entries + "\n}\n");
    console.log(`Merged ${Object.keys(ours).length} strings into locales/${lang}.`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 3) {
    console.error("usage: node scripts/merge-locales.mjs <bitwarden/clients checkout>");
    process.exit(1);
  }
  mergeLocales(resolve(process.argv[2]));
}
