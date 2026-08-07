import { describe, expect, test } from "bun:test";
import { join } from "node:path";

import { buildCliSkillDirs } from "../skill-paths";

describe("buildCliSkillDirs", () => {
  test("includes both documented project skill locations", () => {
    const cwd = "/tmp/example-project";
    const helixentHome = "/tmp/helixent-home";
    const dirs = buildCliSkillDirs({ cwd, helixentHome });

    expect(dirs).toContain(join(cwd, ".agents/skills"));
    expect(dirs).toContain(join(cwd, ".helixent/skills"));
  });

  test("keeps configured and conventional global skill locations", () => {
    const cwd = "/tmp/example-project";
    const helixentHome = "/tmp/helixent-home";
    const dirs = buildCliSkillDirs({ cwd, helixentHome });

    expect(dirs).toContain(join(helixentHome, "skills"));
    expect(dirs).toContain("~/.agents/skills");
    expect(dirs).toContain("~/.helixent/skills");
  });
});
