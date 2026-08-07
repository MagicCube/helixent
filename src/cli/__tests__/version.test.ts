import { describe, expect, test } from "bun:test";

import { HELIXENT_NAME, HELIXENT_VERSION } from "../version";

describe("CLI release metadata", () => {
  test("matches package.json name and version", async () => {
    const packageJsonUrl = new URL("../../../package.json", import.meta.url);
    const pkg = (await Bun.file(packageJsonUrl).json()) as { name: string; version: string };

    expect(HELIXENT_NAME).toBe(pkg.name);
    expect(HELIXENT_VERSION).toBe(pkg.version);
  });
});
