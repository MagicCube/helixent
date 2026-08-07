import matter from "gray-matter";

import type { SkillFrontmatter } from "./types";

function requiredFrontmatterString(data: Record<string, unknown>, field: "name" | "description", path: string): string {
  const value = data[field];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Skill ${path} must define a non-empty ${field} in frontmatter.`);
  }
  return value.trim();
}

export async function readSkillFrontMatter(path: string): Promise<SkillFrontmatter> {
  const file = Bun.file(path);
  if (!(await file.exists())) {
    throw new Error(`File ${path} does not exist`);
  }
  const content = await file.text();
  const parsedFile = matter(content);
  const data = parsedFile.data as Record<string, unknown>;

  return {
    name: requiredFrontmatterString(data, "name", path),
    description: requiredFrontmatterString(data, "description", path),
    path,
  };
}
