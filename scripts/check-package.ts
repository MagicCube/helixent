import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageJsonPath = resolve(root, "package.json");

type PackageJson = {
  files?: string[];
  module?: string;
  exports?: Record<string, string>;
};

const requiredExports: Record<string, string> = {
  ".": "./dist/js/index.js",
  "./foundation": "./dist/js/foundation/index.js",
  "./agent": "./dist/js/agent/index.js",
  "./coding": "./dist/js/coding/index.js",
  "./community/openai": "./dist/js/community/openai/index.js",
  "./community/anthropic": "./dist/js/community/anthropic/index.js",
};

const pkg = (await Bun.file(packageJsonPath).json()) as PackageJson;
const errors: string[] = [];

if (pkg.module !== requiredExports["."]) {
  errors.push(`package.json module must point to ${requiredExports["."]}`);
}

if (!pkg.files?.includes("dist/bin/helixent")) {
  errors.push("package.json files must include dist/bin/helixent");
}
if (!pkg.files?.includes("dist/js")) {
  errors.push("package.json files must include dist/js");
}

for (const [subpath, target] of Object.entries(requiredExports)) {
  if (pkg.exports?.[subpath] !== target) {
    errors.push(`package.json export ${subpath} must point to ${target}`);
  }

  const absoluteTarget = resolve(root, target.replace(/^\.\//, ""));
  if (!(await Bun.file(absoluteTarget).exists())) {
    errors.push(`Built export target is missing: ${target}`);
  }
}

const binaryPath = resolve(root, "dist/bin/helixent");
if (!(await Bun.file(binaryPath).exists())) {
  errors.push("Built CLI binary is missing: dist/bin/helixent");
}

const pack = Bun.spawn(["bun", "pm", "pack", "--dry-run", "--ignore-scripts"], {
  cwd: root,
  stdout: "pipe",
  stderr: "pipe",
});
const [packOutput, packError, packExitCode] = await Promise.all([
  new Response(pack.stdout).text(),
  new Response(pack.stderr).text(),
  pack.exited,
]);

if (packExitCode !== 0) {
  errors.push(`bun pm pack --dry-run failed: ${packError.trim()}`);
} else {
  const expectedPublishedPaths = [
    "dist/bin/helixent",
    ...Object.values(requiredExports).map((target) => target.replace(/^\.\//, "")),
  ];

  for (const path of expectedPublishedPaths) {
    if (!packOutput.includes(path)) {
      errors.push(`Package dry-run does not include required path: ${path}`);
    }
  }
}

if (errors.length > 0) {
  console.error("Package smoke check failed:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.info("Package smoke check passed.");
