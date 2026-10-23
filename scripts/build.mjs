// Overlay build orchestration for the vaultwarden Secrets Manager web vault.
//
// Flow: fetch the pinned bitwarden/clients tag into .build/clients, lay our clean-room overlay
// files over it, apply the route/nav patches, merge our UI strings into its locales, install, build
// the OSS self-host bundle, and collect the static output into dist/. The upstream checkout is
// disposable — everything we own lives in overlay/, patches/ and locales/.
//
// Usage:
//   node scripts/build.mjs              full build
//   node scripts/build.mjs --fetch-only fetch + overlay + patch, skip install/build
//   node scripts/build.mjs --clean      remove .build/ and dist/

import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { mergeLocales } from "./merge-locales.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BUILD = resolve(ROOT, ".build");
const CLIENTS = resolve(BUILD, "clients");
const DIST = resolve(ROOT, "dist");
const WEB_BUILD = resolve(CLIENTS, "apps/web/build");

const args = new Set(process.argv.slice(2));

function run(cmd, cmdArgs, cwd = ROOT) {
  console.log(`\n$ ${cmd} ${cmdArgs.join(" ")}   (in ${cwd})`);
  execFileSync(cmd, cmdArgs, { cwd, stdio: "inherit" });
}

function readUpstream() {
  return JSON.parse(readFileSync(resolve(ROOT, "upstream.json"), "utf8"));
}

function clean() {
  rmSync(BUILD, { recursive: true, force: true });
  rmSync(DIST, { recursive: true, force: true });
  console.log("Removed .build/ and dist/.");
}

// Shallow-clone the pinned tag (or reset an existing checkout back to it, discarding prior overlay).
function fetchClients() {
  const { repo, ref } = readUpstream();
  if (!existsSync(CLIENTS)) {
    mkdirSync(BUILD, { recursive: true });
    run("git", ["clone", "--depth", "1", "--branch", ref, repo, CLIENTS]);
  } else {
    run("git", ["fetch", "--depth", "1", "origin", "tag", ref], CLIENTS);
    run("git", ["checkout", "--force", ref], CLIENTS);
    run("git", ["clean", "-fdx", "apps", "libs", "bitwarden_license"], CLIENTS);
  }
}

// Copy everything under overlay/ onto the checkout, preserving relative paths.
function applyOverlay() {
  const overlay = resolve(ROOT, "overlay");
  if (!existsSync(overlay)) {
    console.log("No overlay/ directory; skipping file overlay.");
    return;
  }
  cpSync(overlay, CLIENTS, { recursive: true });
  console.log("Overlaid clean-room files onto the checkout.");
}

// Apply every patch in patches/ (sorted) with `git apply`. Patches are generated against the pinned
// ref; see patches/README.md for how to refresh them when the pin moves.
function applyPatches() {
  const patchesDir = resolve(ROOT, "patches");
  if (!existsSync(patchesDir)) {
    return;
  }
  const patches = readdirSync(patchesDir)
    .filter((f) => f.endsWith(".patch"))
    .sort();
  for (const p of patches) {
    run("git", ["apply", "--whitespace=nowarn", resolve(patchesDir, p)], CLIENTS);
  }
  if (patches.length === 0) {
    console.log("No patches to apply yet.");
  }
}

function installAndBuild() {
  run("npm", ["ci"], CLIENTS);
  // build:oss:selfhost:prod runs webpack with ENV=selfhosted NODE_ENV=production and emits to
  // apps/web/build (the static bundle for vaultwarden's WEB_VAULT_FOLDER).
  run("npm", ["run", "build:oss:selfhost:prod", "--workspace", "@bitwarden/web-vault"], CLIENTS);
}

function collectDist() {
  rmSync(DIST, { recursive: true, force: true });
  mkdirSync(DIST, { recursive: true });
  cpSync(WEB_BUILD, DIST, { recursive: true });
  console.log(`\nStatic web-vault bundle ready in ${DIST} — baked into the vaultwarden-sm-web image at docker build.`);
}

if (args.has("--clean")) {
  clean();
  process.exit(0);
}

fetchClients();
applyOverlay();
applyPatches();
mergeLocales(CLIENTS);

if (args.has("--fetch-only")) {
  console.log("\n--fetch-only: stopped before install/build.");
  process.exit(0);
}

installAndBuild();
collectDist();
