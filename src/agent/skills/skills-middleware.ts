import type { Dirent } from "node:fs";
import fs, { exists } from "node:fs/promises";
import os from "node:os";
import { join } from "node:path";

import type { AgentMiddleware } from "../agent-middleware";

import { warnInvalidSkill } from "./skill-errors";
import { readSkillFrontMatter } from "./skill-reader";
import type { SkillFrontmatter } from "./types";

/**
 * Loads skills from one or more `skillsDirs`.
 *
 * ## Discovery
 * - Each `skillsDir` is expected to contain subfolders, each representing one skill.
 * - A skill is discovered when `<skillsDir>/<folder>/SKILL.md` exists.
 * - `~` is expanded to the current user's home directory.
 * - Invalid skill frontmatter is skipped with a warning instead of aborting the agent run.
 *
 * ## Duplicate handling (important)
 * - **There is no "same-name skill overrides another" behavior.**
 * - Dedupe is done by the *resolved SKILL.md file path* (full path string) only.
 *   - If two different `skillsDirs` both contain a `my-skill/SKILL.md`, they are treated as
 *     **two distinct skills** because their file paths differ.
 *   - The only time a skill is deduped is when the exact same `SKILL.md` path is encountered
 *     more than once (e.g. `skillsDirs` contains duplicate entries / aliases pointing to the
 *     same directory).
 *
 * ## Ordering
 * - Skills are appended in the order of `skillsDirs`, then the directory listing order of each
 *   `skillsDir` (as returned by `readdir`).
 */
export function createSkillsMiddleware(skillsDirs: string[] = [join(process.cwd(), "skills")]): AgentMiddleware {
  return {
    beforeAgentRun: async () => {
      const skills: SkillFrontmatter[] = [];
      const seenSkillFiles = new Set<string>();

      for (let skillsDir of skillsDirs) {
        if (skillsDir.startsWith("~")) {
          skillsDir = join(os.homedir(), skillsDir.slice(1));
        }
        if (!(await exists(skillsDir))) {
          continue;
        }

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

      return {
        skills,
      };
    },

    beforeModel: async ({ modelContext, agentContext }) => {
      if (agentContext.skills && agentContext.skills.length > 0) {
        const requestedSkill = agentContext.requestedSkillName
          ? agentContext.skills.find(
              (skill) => skill.name.toLowerCase() === agentContext.requestedSkillName?.toLowerCase(),
            )
          : null;

        const skillsXML = agentContext.skills
          .map((skill) => `<skill name="${skill.name}" path="${skill.path}">\n${skill.description}\n</skill>`)
          .join("\n");

        return {
          prompt:
            modelContext.prompt +
            `\n
<skill_system>
<instructions>
You have access to skills that provide optimized workflows for specific tasks. Each skill contains best practices, frameworks, and references to additional resources.

**Progressive Loading Pattern:**
1. When a user query matches a skill's use case, immediately call \`read_file\` on the skill's main file using the path attribute provided in the skill tag below
2. If an explicit requested skill is provided in the system context, load that skill first even if the user message is short
3. Read and understand the skill's workflow and instructions
4. The skill file contains references to external resources under the same folder
5. Load referenced resources only when needed during execution
6. Follow the skill's instructions precisely
</instructions>

${
  requestedSkill
    ? `<explicit_skill_invocation>
The user explicitly selected the skill "${requestedSkill.name}" from the slash command picker.
You must read the matching skill file at "${requestedSkill.path}" before answering.
</explicit_skill_invocation>
`
    : ""
}

<skills>
${skillsXML}
</skills>
</skill_system>`,
        };
      }
    },
  };
}
