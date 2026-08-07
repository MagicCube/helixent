import { join } from "node:path";

export function buildCliSkillDirs({
  cwd = process.cwd(),
  helixentHome,
}: {
  cwd?: string;
  helixentHome: string;
}): string[] {
  return [
    join(cwd, "skills"),
    join(cwd, ".agents/skills"),
    join(cwd, ".helixent/skills"),
    join(helixentHome, "skills"),
    "~/.agents/skills",
    "~/.helixent/skills",
  ];
}
