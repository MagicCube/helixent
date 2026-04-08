import type { Dirent } from "fs";
import fs, { exists } from "fs/promises";
import { join } from "path";

import { readSkillFrontMatter } from "./skill-reader";
import type { SkillFrontmatter } from "./types";

export async function listSkills(
  skillsDirs: string[] = [join(process.cwd(), "skills")],
): Promise<SkillFrontmatter[]> {
  const skills: SkillFrontmatter[] = [];
  const seenSkillFiles = new Set<string>();

  for (const skillsDir of skillsDirs) {
    let folders: Dirent[];
    try {
      folders = await fs.readdir(skillsDir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const folder of folders) {
      const skillFilePath = join(skillsDir, folder.name, "SKILL.md");
      if (!folder.isDirectory()) continue;
      if (seenSkillFiles.has(skillFilePath)) continue;
      if (!(await exists(skillFilePath))) continue;

      seenSkillFiles.add(skillFilePath);
      const frontmatter = await readSkillFrontMatter(skillFilePath);
      skills.push(frontmatter);
    }
  }

  return skills;
}
