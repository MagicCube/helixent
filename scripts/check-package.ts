import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageJsonPath = resolve(root, "package.json");

type PackageExport = {
  types?: string;
  import?: string;
  default?: string;
};

type PackageJson = {
  files?: string[];
  module?: string;
  types?: string;
  exports?: Record<string, PackageExport>;
};

const requiredExports: Record<string, { runtime: string; types: string }> = {
  ".": { runtime: "./dist/js/index.js", types: "./dist/types/index.d.ts" },
  "./foundation": { runtime: "./dist/js/foundation/index.js", types: "./dist/types/foundation/index.d.ts" },
  "./agent": { runtime: "./dist/js/agent/index.js", types: "./dist/types/agent/index.d.ts" },
  "./coding": { runtime: "./dist/js/coding/index.js", types: "./dist/types/coding/index.d.ts" },
  "./community/openai": {
    runtime: "./dist/js/community/openai/index.js",
    types: "./dist/types/community/openai/index.d.ts",
  },
  "./community/anthropic": {
    runtime: "./dist/js/community/anthropic/index.js",
    types: "./dist/types/community/anthropic/index.d.ts",
  },
};

const pkg = (await Bun.file(packageJsonPath).json()) as PackageJson;
const errors: string[] = [];

if (pkg.module !== requiredExports["."]!.runtime) {
  errors.push(`package.json module must point to ${requiredExports["."]!.runtime}`);
}
if (pkg.types !== requiredExports["."]!.types) {
  errors.push(`package.json types must point to ${requiredExports["."]!.types}`);
}

for (const requiredFile of ["dist/bin/helixent", "dist/js", "dist/types"]) {
  if (!pkg.files?.includes(requiredFile)) {
    errors.push(`package.json files must include ${requiredFile}`);
  }
}

for (const [subpath, targets] of Object.entries(requiredExports)) {
  const exported = pkg.exports?.[subpath];
  if (exported?.types !== targets.types) {
    errors.push(`package.json export ${subpath} types must point to ${targets.types}`);
  }
  if (exported?.import !== targets.runtime || exported?.default !== targets.runtime) {
    errors.push(`package.json export ${subpath} runtime must point to ${targets.runtime}`);
  }

  for (const target of [targets.runtime, targets.types]) {
    const absoluteTarget = resolve(root, target.replace(/^\.\//, ""));
    if (!(await Bun.file(absoluteTarget).exists())) {
      errors.push(`Built export target is missing: ${target}`);
    }
  }
}

const typeGlob = new Bun.Glob("**/*.d.ts");
const relativeModuleSpecifier = /\b(?:from|import)\s*\(?\s*["'](\.\.?\/[^"']+)["']/g;
const explicitRuntimeExtension = /\.(?:[cm]?js|json|node)$/;
for await (const typeFile of typeGlob.scan({ cwd: resolve(root, "dist/types"), absolute: true })) {
  const content = await Bun.file(typeFile).text();
  if (content.includes('"@/') || content.includes("'@/")) {
    errors.push(`Published declaration contains an unresolved internal alias: ${typeFile}`);
  }

  relativeModuleSpecifier.lastIndex = 0;
  for (const match of content.matchAll(relativeModuleSpecifier)) {
    const specifier = match[1];
    if (specifier && !explicitRuntimeExtension.test(specifier)) {
      errors.push(`Published declaration contains a NodeNext-unsafe relative specifier ${specifier}: ${typeFile}`);
    }
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
    ...Object.values(requiredExports).flatMap(({ runtime, types }) => [runtime, types]).map((target) => target.replace(/^\.\//, "")),
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
