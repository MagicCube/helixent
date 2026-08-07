import { dirname, relative, resolve, sep } from "node:path";

const typesRoot = resolve(import.meta.dir, "../dist/types");
const declarations = new Bun.Glob("**/*.d.ts");
let rewrittenFiles = 0;

for await (const filePath of declarations.scan({ cwd: typesRoot, absolute: true })) {
  const file = Bun.file(filePath);
  const original = await file.text();
  const rewritten = original.replace(/(["'])@\/([^"']+)\1/g, (_match, quote: string, aliasPath: string) => {
    const target = resolve(typesRoot, aliasPath);
    let specifier = relative(dirname(filePath), target).split(sep).join("/");
    if (!specifier.startsWith(".")) {
      specifier = `./${specifier}`;
    }
    return `${quote}${specifier}${quote}`;
  });

  if (rewritten !== original) {
    await Bun.write(filePath, rewritten);
    rewrittenFiles += 1;
  }
}

console.info(`Rewrote internal aliases in ${rewrittenFiles} declaration file(s).`);
