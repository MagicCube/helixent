import type { Dirent } from "node:fs";
import fs, { exists } from "node:fs/promises";
import os from "node:os";
import { join } from "node:path";

import { warnInvalidSkill } from "./skill-errors";
import { readSkillFrontMatter } from "./skill-reader";
import type { SkillFrontmatter } from "./types";

export async function listSkills(
  skillsDirs: string[] = [join(process.cwd(), "skills")],
): Promise<SkillFrontmatter[]> {
  const skills: SkillFrontmatter[] = [];
  const seenSkillFiles = new Set<string>();

  for (let skillsDir of skillsDirs) {
    if (skillsDir.startsWith("~")) {
      skillsDir = join(os.homedir(), skillsDir.slice(1));
    }
    if (!(await exists(skillsDir))) continue;

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
      try {
        const frontmatter = await readSkillFrontMatter(skillFilePath);
        skills.push(frontmatter);
      } catch (error) {
        warnInvalidSkill(skillFilePath, error);
      }
    }
  }

  return skills;
}
