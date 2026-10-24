// Merge our own UI strings into the web vault's locale files.
//
// The web vault already ships the Secrets Manager strings with translations, so the overlay reuses
// those keys. Per language, locales/<lang>/ may hold:
//   messages.json  — strings with no upstream key; additive: a key that already exists upstream
//                    fails the merge instead of silently overriding a translation.
//   overrides.json — deliberate rewordings of upstream translations; every key must exist upstream
//                    (a typo or a key dropped upstream fails the merge).
// Languages without our files fall back to English, as the web vault's I18nService does for any
// missing key.
//
// Usage: node scripts/merge-locales.mjs <bitwarden/clients checkout>

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const OURS = resolve(dirname(fileURLToPath(import.meta.url)), "../locales");

function readOurs(lang, file) {
  const path = resolve(OURS, lang, file);
  return existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : {};
}

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function mergeLocales(clientsRoot) {
  const upstreamDir = resolve(clientsRoot, "apps/web/src/locales");
  for (const lang of readdirSync(OURS)) {
    const target = resolve(upstreamDir, lang, "messages.json");
    if (!existsSync(target)) {
      throw new Error(`locales/${lang}: the web vault has no such locale`);
    }
    // The upstream file is edited as text, never re-serialized, so it stays byte-for-byte as
    // shipped apart from our changes (it has duplicate keys that a parse/stringify round-trip
    // would drop).
    let text = readFileSync(target, "utf8");
    const upstream = JSON.parse(text);

    const overrides = readOurs(lang, "overrides.json");
    for (const [key, { message }] of Object.entries(overrides)) {
      if (!(key in upstream)) {
        throw new Error(`locales/${lang}/overrides.json: no upstream key ${key}`);
      }
      const entry = new RegExp(`("${escapeRegExp(key)}":\\s*\\{\\s*"message":\\s*)"(?:[^"\\\\]|\\\\.)*"`, "g");
      if (!entry.test(text)) {
        throw new Error(`locales/${lang}: cannot locate the message of ${key}`);
      }
      text = text.replace(entry, (_, head) => head + JSON.stringify(message));
    }

    const added = readOurs(lang, "messages.json");
    const clash = Object.keys(added).filter((k) => k in upstream);
    if (clash.length > 0) {
      throw new Error(`locales/${lang}: keys already defined upstream: ${clash.join(", ")}`);
    }
    if (Object.keys(added).length > 0) {
      const entries = JSON.stringify(added, null, 2).slice(1, -2); // the object body, no braces
      const end = text.lastIndexOf("}");
      text = text.slice(0, end).trimEnd() + "," + entries + "\n}\n";
    }

    writeFileSync(target, text);
    console.log(
      `locales/${lang}: ${Object.keys(added).length} added, ${Object.keys(overrides).length} overridden.`,
    );
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 3) {
    console.error("usage: node scripts/merge-locales.mjs <bitwarden/clients checkout>");
    process.exit(1);
  }
  mergeLocales(resolve(process.argv[2]));
}
