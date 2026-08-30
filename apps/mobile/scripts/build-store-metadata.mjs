#!/usr/bin/env node
/**
 * Resolves the store listing templates into files you can paste from.
 *
 * The templates carry `${PLACEHOLDER}` markers and nothing in the repo used to
 * replace them, so the listing said "2026 " where the company name goes and
 * pointed the reviewer at "${WEB_URL}/support". Anything unresolved is an
 * error here rather than something noticed in App Store Connect.
 *
 *   node scripts/build-store-metadata.mjs           # writes store/build
 *   node scripts/build-store-metadata.mjs --check   # verifies only
 */
import { readdirSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const MOBILE_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");
const STORE_DIR = join(MOBILE_DIR, "store");
const OUT_DIR = join(STORE_DIR, "build");

/** Every marker a template may use, and where its value comes from. */
const SOURCES = {
  WEB_URL: "EXPO_PUBLIC_WEB_URL",
  SUPPORT_EMAIL: "EXPO_PUBLIC_SUPPORT_EMAIL",
  LEGAL_ENTITY_NAME: "EXPO_PUBLIC_LEGAL_ENTITY_NAME",
  APP_REVIEW_EMAIL: "APP_REVIEW_EMAIL",
  APP_REVIEW_PASSWORD: "APP_REVIEW_PASSWORD",
};

/** App Store Connect refuses anything longer, so catch it here instead. */
const LIMITS = {
  name: 30,
  subtitle: 30,
  promotionalText: 170,
  description: 4000,
  keywords: 100,
};

function loadEnvFile(path) {
  let contents;
  try {
    contents = readFileSync(path, "utf8");
  } catch {
    return {};
  }
  const values = {};
  for (const line of contents.split("\n")) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match) values[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
  return values;
}

// A real environment wins over the file, so CI can pass secrets in directly.
const fileEnv = loadEnvFile(join(MOBILE_DIR, ".env.local"));
const readValue = (name) => process.env[name] || fileEnv[name] || "";

function templateFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "build" ? [] : templateFiles(full);
    return /\.(json|txt)$/.test(entry.name) ? [full] : [];
  });
}

const problems = [];
const resolved = [];

for (const file of templateFiles(STORE_DIR)) {
  const template = readFileSync(file, "utf8");
  const output = template.replace(/\$\{([A-Z0-9_]+)\}/g, (whole, marker) => {
    const source = SOURCES[marker];
    if (!source) {
      problems.push(`${relative(STORE_DIR, file)}: no source defined for ${whole}`);
      return whole;
    }
    const value = readValue(source);
    if (!value) {
      problems.push(
        `${relative(STORE_DIR, file)}: ${whole} needs ${source}, which is empty`,
      );
      return whole;
    }
    return value;
  });

  if (file.endsWith(".json")) {
    let parsed;
    try {
      parsed = JSON.parse(output);
    } catch (error) {
      problems.push(`${relative(STORE_DIR, file)}: not valid JSON — ${error.message}`);
    }
    for (const [field, limit] of Object.entries(LIMITS)) {
      const value = parsed?.[field];
      if (typeof value === "string" && value.length > limit) {
        problems.push(
          `${relative(STORE_DIR, file)}: ${field} is ${value.length} characters, limit is ${limit}`,
        );
      }
    }
  }

  resolved.push({ file, output });
}

if (problems.length > 0) {
  console.error("Store metadata is not ready:\n");
  for (const problem of problems) console.error(`  ${problem}`);
  console.error(
    "\nSet the missing values in apps/mobile/.env.local or the environment.",
  );
  process.exit(1);
}

if (process.argv.includes("--check")) {
  console.log(`Store metadata resolves cleanly (${resolved.length} files).`);
  process.exit(0);
}

for (const { file, output } of resolved) {
  const destination = join(OUT_DIR, relative(STORE_DIR, file));
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, output);
}
console.log(`Wrote ${resolved.length} files to ${relative(MOBILE_DIR, OUT_DIR)}.`);
