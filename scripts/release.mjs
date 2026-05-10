// Bumps the app version across package.json, tauri.conf.json, and Cargo.toml,
// commits the bump, and pushes a git tag. The GitHub Actions release workflow
// takes over from there: builds + signs on Windows/macOS/Linux, publishes a
// GitHub Release with installers + latest.json. The running app polls the
// release endpoint and prompts users to install.
//
// Usage:
//   npm run release           # patch bump (0.1.0 -> 0.1.1)
//   npm run release:minor
//   npm run release:major

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));

const bumpKind = process.argv.includes("--major") ? "major"
  : process.argv.includes("--minor") ? "minor"
  : "patch";

function bump(version, kind) {
  const [maj, min, pat] = version.split(".").map(Number);
  if (kind === "major") return `${maj + 1}.0.0`;
  if (kind === "minor") return `${maj}.${min + 1}.0`;
  return `${maj}.${min}.${pat + 1}`;
}

function sh(cmd) { execSync(cmd, { stdio: "inherit", cwd: root }); }

const pkgPath = join(root, "package.json");
const tauriPath = join(root, "src-tauri", "tauri.conf.json");
const cargoPath = join(root, "src-tauri", "Cargo.toml");

const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
const tauri = JSON.parse(readFileSync(tauriPath, "utf8"));
const cargo = readFileSync(cargoPath, "utf8");

const current = tauri.version;
const next = bump(current, bumpKind);

console.log(`Releasing ${current} -> ${next} (${bumpKind})`);

pkg.version = next;
tauri.version = next;
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
writeFileSync(tauriPath, JSON.stringify(tauri, null, 2) + "\n");
writeFileSync(
  cargoPath,
  cargo.replace(/(\[package\][\s\S]*?\nversion\s*=\s*")[^"]+(")/, `$1${next}$2`)
);

sh(`git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml`);
sh(`git commit -m "release: v${next}"`);
sh(`git tag v${next}`);
sh(`git push`);
sh(`git push origin v${next}`);

console.log(`\nTagged v${next}. GitHub Actions is now building installers.`);
console.log(`Watch progress: gh run watch`);
console.log(`Once the release is published, the running app will detect it within ~5 minutes.`);
