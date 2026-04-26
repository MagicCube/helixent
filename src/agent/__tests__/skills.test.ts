import { mkdir, rm, writeFile } from "node:fs/promises";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { listSkills } from "../skills/list-skills";
import { readSkillFrontMatter } from "../skills/skill-reader";

describe("readSkillFrontMatter", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "helixent-skill-reader-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  test("reads frontmatter from a SKILL.md file", async () => {
    const skillPath = join(tempDir, "SKILL.md");
    await writeFile(skillPath, `---
name: my-skill
description: A test skill
---

# My Skill

Some content here.
`);
    const result = await readSkillFrontMatter(skillPath);
    expect(result.name).toBe("my-skill");
    expect(result.description).toBe("A test skill");
    expect(result.path).toBe(skillPath);
  });

  test("throws when file does not exist", async () => {
    await expect(readSkillFrontMatter(join(tempDir, "nonexistent.md"))).rejects.toThrow("does not exist");
  });

  test("handles SKILL.md with no frontmatter", async () => {
    const skillPath = join(tempDir, "SKILL.md");
    await writeFile(skillPath, "Just plain content, no frontmatter.");
    const result = await readSkillFrontMatter(skillPath);
    expect(result.name).toBeUndefined();
    expect(result.description).toBeUndefined();
    expect(result.path).toBe(skillPath);
  });
});

describe("listSkills", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "helixent-list-skills-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  test("discovers skills from a directory with SKILL.md subfolders", async () => {
    const skillDir = join(tempDir, "skills");
    await mkdir(join(skillDir, "skill-a"), { recursive: true });
    await writeFile(
      join(skillDir, "skill-a", "SKILL.md"),
      `---\nname: skill-a\ndescription: Skill A\n---\n`,
    );
    await mkdir(join(skillDir, "skill-b"), { recursive: true });
    await writeFile(
      join(skillDir, "skill-b", "SKILL.md"),
      `---\nname: skill-b\ndescription: Skill B\n---\n`,
    );

    const skills = await listSkills([skillDir]);
    expect(skills).toHaveLength(2);
    const names = skills.map((s) => s.name);
    expect(names).toContain("skill-a");
    expect(names).toContain("skill-b");
  });

  test("skips directories without SKILL.md", async () => {
    const skillDir = join(tempDir, "skills");
    await mkdir(join(skillDir, "no-skill"), { recursive: true });
    // No SKILL.md created

    const skills = await listSkills([skillDir]);
    expect(skills).toHaveLength(0);
  });

  test("skips non-directory entries", async () => {
    const skillDir = join(tempDir, "skills");
    await mkdir(skillDir);
    await writeFile(join(skillDir, "readme.txt"), "not a directory");

    const skills = await listSkills([skillDir]);
    expect(skills).toHaveLength(0);
  });

  test("returns empty array for non-existent directory", async () => {
    const skills = await listSkills([join(tempDir, "does-not-exist")]);
    expect(skills).toHaveLength(0);
  });


});
