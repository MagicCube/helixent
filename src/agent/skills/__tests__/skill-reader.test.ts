import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { listSkills } from "../list-skills";
import { readSkillFrontMatter } from "../skill-reader";

const temporaryRoots: string[] = [];

async function makeTempRoot() {
  const root = await mkdtemp(join(tmpdir(), "helixent-skills-"));
  temporaryRoots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("skill frontmatter validation", () => {
  test("trims required name and description fields", async () => {
    const root = await makeTempRoot();
    const skillPath = join(root, "SKILL.md");
    await writeFile(
      skillPath,
      ["---", "name: '  useful-skill  '", "description: '  Useful workflow  '", "---", "Body", ""].join("\n"),
      "utf8",
    );

    await expect(readSkillFrontMatter(skillPath)).resolves.toEqual({
      name: "useful-skill",
      description: "Useful workflow",
      path: skillPath,
    });
  });

  test("rejects missing required metadata before later middleware can dereference it", async () => {
    const root = await makeTempRoot();
    const skillPath = join(root, "SKILL.md");
    await writeFile(skillPath, ["---", "description: Missing a name", "---", "Body", ""].join("\n"), "utf8");

    await expect(readSkillFrontMatter(skillPath)).rejects.toThrow("non-empty name");
  });

  test("listSkills skips one invalid skill without hiding valid siblings", async () => {
    const root = await makeTempRoot();
    const validDir = join(root, "valid");
    const invalidDir = join(root, "invalid");
    await mkdir(validDir, { recursive: true });
    await mkdir(invalidDir, { recursive: true });

    await writeFile(
      join(validDir, "SKILL.md"),
      ["---", "name: valid-skill", "description: Valid workflow", "---", "Body", ""].join("\n"),
      "utf8",
    );
    await writeFile(
      join(invalidDir, "SKILL.md"),
      ["---", "name: invalid-skill", "---", "Body", ""].join("\n"),
      "utf8",
    );

    const skills = await listSkills([root]);
    expect(skills).toHaveLength(1);
    expect(skills[0]).toMatchObject({ name: "valid-skill", description: "Valid workflow" });
  });
});
