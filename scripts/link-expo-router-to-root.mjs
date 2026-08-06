import { existsSync, lstatSync, symlinkSync, unlinkSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// The Expo CLI's typed-route generator lives at node_modules/expo/node_modules/@expo/cli
// and requires `expo-router/_ctx-shared`. Node resolves that from the CLI's own location,
// which never reaches apps/mobile/node_modules. npm refuses to hoist expo-router to the
// root because its react-server-dom-webpack peer wants react ^19.2.8 while the root
// resolves react 19.2.3, so this link stands in for the hoist until those versions align.

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const linkPath = join(repoRoot, "node_modules", "expo-router");
const targetPath = join(repoRoot, "apps", "mobile", "node_modules", "expo-router");

if (!existsSync(targetPath)) {
  console.log("link-expo-router-to-root: apps/mobile/node_modules/expo-router not installed, skipping");
  process.exit(0);
}

if (existsSync(join(linkPath, "package.json")) && !lstatSync(linkPath).isSymbolicLink()) {
  console.log("link-expo-router-to-root: expo-router is already hoisted, nothing to do");
  process.exit(0);
}

if (lstatSync(linkPath, { throwIfNoEntry: false })) {
  unlinkSync(linkPath);
}

symlinkSync(targetPath, linkPath, "dir");
console.log("link-expo-router-to-root: linked node_modules/expo-router -> apps/mobile/node_modules/expo-router");
