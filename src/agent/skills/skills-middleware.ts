import type { Dirent } from "fs";
import fs, { exists } from "fs/promises";
import { join } from "path";

import type { AgentMiddleware } from "../agent-middleware";

import { readSkillFrontMatter } from "./skill-reader";
import type { SkillFrontmatter } from "./types";

export function createSkillsMiddleware(
  skillsDirs: string[] = [join(process.cwd(), "skills")],
): AgentMiddleware {
  return {
    beforeAgentRun: async () => {
      const skills: SkillFrontmatter[] = [];
      const seenSkillFiles = new Set<string>();

      for (const skillsDir of skillsDirs) {
        let folders: Dirent[];
        try {
          folders = await fs.readdir(skillsDir, { withFileTypes: true });
        } catch {
          // Missing/invalid skills directory; treat as empty.
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
      return {
        skills,
      };
    },

    beforeModel: async ({ modelContext, agentContext }) => {
      if (agentContext.skills && agentContext.skills.length > 0) {
        return {
          prompt:
            modelContext.prompt +
            `\n
<skill_system>
You have access to skills that provide optimized workflows for specific tasks. Each skill contains best practices, frameworks, and references to additional resources.

**Progressive Loading Pattern:**
1. When a user query matches a skill's use case, immediately call \`read_file\` on the skill's main file using the path attribute provided in the skill tag below
2. Read and understand the skill's workflow and instructions
3. The skill file contains references to external resources under the same folder
4. Load referenced resources only when needed during execution
5. Follow the skill's instructions precisely

<skills>
${JSON.stringify(agentContext.skills, null, 2)}
</skills>
</skill_system>`,
        };
      }
    },
  };
}
