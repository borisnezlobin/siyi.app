import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// expo-widgets bundles its widget JS with its own Metro config, which watches
// <repo>/node_modules rather than <repo>. Metro's file map does not retain files
// under a watchFolder that is itself a node_modules directory, so hoisted packages
// (expo/virtual/streams.js) are absent from the map and the bundle fails with
// "Failed to get the SHA-1". Watching the workspace root as well fixes it.

const marker = "widen-expo-widgets-watch-folders";
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const configPath = join(repoRoot, "apps", "mobile", "node_modules", "expo-widgets", "metro.config.js");

if (!existsSync(configPath)) {
  console.log("widen-expo-widgets-watch-folders: expo-widgets not installed, skipping");
  process.exit(0);
}

const contents = readFileSync(configPath, "utf8");

if (contents.includes(marker)) {
  console.log("widen-expo-widgets-watch-folders: already applied");
  process.exit(0);
}

const patch = `

// Appended by scripts/${marker}.mjs
{
  const { resolveWorkspaceRoot: findWorkspaceRoot } = require('resolve-workspace-root');
  const workspaceRoot = findWorkspaceRoot(process.cwd());
  if (workspaceRoot && !module.exports.watchFolders.includes(workspaceRoot)) {
    module.exports.watchFolders.push(workspaceRoot);
  }
}
`;

writeFileSync(configPath, contents + patch);
console.log("widen-expo-widgets-watch-folders: patched expo-widgets metro config");
