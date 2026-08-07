import { existsSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";

const typesRoot = resolve(import.meta.dir, "../dist/types");
const declarations = new Bun.Glob("**/*.d.ts");
const explicitRuntimeExtension = /\.(?:[cm]?js|json|node)$/;

function toPortableRelative(fromDir: string, target: string): string {
  let specifier = relative(fromDir, target).split(sep).join("/");
  if (!specifier.startsWith(".")) {
    specifier = `./${specifier}`;
  }
  return specifier;
}

function resolveDeclarationRuntimeTarget(specifier: string, declarationPath: string): string | null {
  if (specifier.startsWith("@/")) {
    const target = resolve(typesRoot, specifier.slice(2));
    if (existsSync(`${target}.d.ts`)) return `${target}.js`;
    if (existsSync(resolve(target, "index.d.ts"))) return resolve(target, "index.js");
    return null;
  }

  if (!specifier.startsWith("./") && !specifier.startsWith("../")) {
    return null;
  }
  if (explicitRuntimeExtension.test(specifier)) {
    return null;
  }

  const target = resolve(dirname(declarationPath), specifier);
  if (existsSync(`${target}.d.ts`)) return `${target}.js`;
  if (existsSync(resolve(target, "index.d.ts"))) return resolve(target, "index.js");
  return null;
}

function rewriteModuleSpecifiers(content: string, declarationPath: string): string {
  const moduleSpecifier = /(\b(?:from|import)\s*\(?\s*)(["'])(@\/[^"']+|\.\.?\/[^"']+)\2/g;

  return content.replace(moduleSpecifier, (match, prefix: string, quote: string, specifier: string) => {
    const target = resolveDeclarationRuntimeTarget(specifier, declarationPath);
    if (!target) return match;
    const rewritten = toPortableRelative(dirname(declarationPath), target);
    return `${prefix}${quote}${rewritten}${quote}`;
  });
}

let rewrittenFiles = 0;
for await (const filePath of declarations.scan({ cwd: typesRoot, absolute: true })) {
  const file = Bun.file(filePath);
  const original = await file.text();
  const rewritten = rewriteModuleSpecifiers(original, filePath);

  if (rewritten !== original) {
    await Bun.write(filePath, rewritten);
    rewrittenFiles += 1;
  }
}

console.info(`Rewrote module specifiers in ${rewrittenFiles} declaration file(s).`);
