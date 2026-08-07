import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageJsonPath = resolve(root, "package.json");
const versionModulePath = resolve(root, "src/cli/version.ts");

const pkg = (await Bun.file(packageJsonPath).json()) as { name?: unknown; version?: unknown };
if (typeof pkg.name !== "string" || pkg.name.length === 0) {
  throw new Error("package.json must contain a non-empty string name");
}
if (typeof pkg.version !== "string" || pkg.version.length === 0) {
  throw new Error("package.json must contain a non-empty string version");
}

const expected = `export const HELIXENT_NAME = ${JSON.stringify(pkg.name)};\nexport const HELIXENT_VERSION = ${JSON.stringify(pkg.version)};\n`;
const checkOnly = process.argv.includes("--check");

if (checkOnly) {
  const current = await Bun.file(versionModulePath).text();
  if (current !== expected) {
    console.error(
      `Version metadata is out of sync. package.json is ${pkg.name}@${pkg.version}, but src/cli/version.ts does not match. Run: bun run scripts/sync-version.ts`,
    );
    process.exit(1);
  }
  console.info(`Version metadata is synchronized: ${pkg.name}@${pkg.version}`);
} else {
  await Bun.write(versionModulePath, expected);
  console.info(`Synchronized src/cli/version.ts to ${pkg.name}@${pkg.version}`);
}
