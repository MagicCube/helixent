import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

import { parse, stringify } from "yaml";

import type { HelixentConfig } from "./schema";
import { helixentConfigSchema } from "./schema";

export type { HelixentConfig, ModelEntry } from "./schema";
export { helixentConfigSchema, modelEntrySchema } from "./schema";

const DEFAULT_REL = ".helixent";
const CONFIG_FILENAME = "config.yaml";
const PRIVATE_DIRECTORY_MODE = 0o700;
const PRIVATE_FILE_MODE = 0o600;

/** Default `~/.helixent` when `HELIXENT_HOME` is unset. */
export function getDefaultHelixentHome(): string {
  return path.join(homedir(), DEFAULT_REL);
}

/** Resolves `HELIXENT_HOME` from the environment (must be set before calling). */
export function getHelixentHomePath(): string {
  const v = Bun.env.HELIXENT_HOME?.trim();
  if (!v) {
    throw new Error("HELIXENT_HOME is not set");
  }
  return path.resolve(v);
}

export function getConfigFilePath(): string {
  return path.join(getHelixentHomePath(), CONFIG_FILENAME);
}

/** True when the helixent home directory exists and `config.yaml` is present. */
export function isHelixentSetupComplete(): boolean {
  const home = getHelixentHomePath();
  if (!existsSync(home) || !statSync(home).isDirectory()) {
    return false;
  }
  return existsSync(getConfigFilePath());
}

export function loadConfig(): HelixentConfig {
  const p = getConfigFilePath();
  const raw = readFileSync(p, "utf8");
  const parsed: unknown = parse(raw);
  return helixentConfigSchema.parse(parsed);
}

export function saveConfig(config: HelixentConfig): void {
  const validated = helixentConfigSchema.parse(config);
  const content = stringify(validated, { lineWidth: 0 });
  const target = getConfigFilePath();
  const tmp = `${target}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tmp, content, { encoding: "utf8", mode: PRIVATE_FILE_MODE });
  renameSync(tmp, target);
}

/** Ensures `HELIXENT_HOME` exists on disk (recursive mkdir). */
export function ensureHelixentHomeDirectory(): void {
  const home = getHelixentHomePath();
  mkdirSync(home, { recursive: true, mode: PRIVATE_DIRECTORY_MODE });
  if (process.platform !== "win32") {
    try {
      chmodSync(home, PRIVATE_DIRECTORY_MODE);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to secure HELIXENT_HOME directory ${home}: ${message}`, { cause: error });
    }
  }
}

/** Sets `HELIXENT_HOME` to the default path if not already set. */
export function ensureHelixentHomeEnv(): void {
  if (!process.env.HELIXENT_HOME?.trim()) {
    const p = getDefaultHelixentHome();
    process.env.HELIXENT_HOME = p;
    if (typeof Bun !== "undefined") {
      Bun.env.HELIXENT_HOME = p;
    }
  }
}
