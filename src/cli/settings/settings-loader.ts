import { homedir } from "node:os";
import { join } from "node:path";

import type { Settings } from "./settings";
import { settingsSchema } from "./settings";

function defaultHelixentHome(): string {
  const v = Bun.env.HELIXENT_HOME?.trim();
  if (v) {
    return v;
  }
  return join(homedir(), ".helixent");
}

async function readJsonFile(path: string): Promise<unknown | undefined> {
  const file = Bun.file(path);
  if (!(await file.exists())) {
    return undefined;
  }
  try {
    return await file.json();
  } catch {
    console.warn(`[helixent] Could not read ${path}; skipping settings layer.`);
    return undefined;
  }
}

async function loadLayer(path: string): Promise<Settings> {
  const data = await readJsonFile(path);
  if (data === undefined) {
    return {};
  }
  const parsed = settingsSchema.safeParse(data);
  if (!parsed.success) {
    console.warn(`[helixent] Invalid settings at ${path}; ignoring layer.`);
    return {};
  }
  return parsed.data;
}

function mergeSettingsLayers(layers: Settings[]): Settings {
  const mergedTop: Record<string, unknown> = {};
  for (const layer of layers) {
    const rec = layer as Record<string, unknown>;
    for (const key of Object.keys(rec)) {
      if (key === "permissions") {
        continue;
      }
      mergedTop[key] = rec[key];
    }
  }

  const allow = new Set<string>();
  const permRest: Record<string, unknown> = {};
  for (const layer of layers) {
    const p = layer.permissions;
    if (!p || typeof p !== "object" || Array.isArray(p)) {
      continue;
    }
    const pRec = p as Record<string, unknown>;
    const rawAllow = pRec.allow;
    if (Array.isArray(rawAllow)) {
      for (const x of rawAllow) {
        if (typeof x === "string") {
          allow.add(x);
        }
      }
    }
    for (const [k, v] of Object.entries(pRec)) {
      if (k === "allow") {
        continue;
      }
      permRest[k] = v;
    }
  }

  const out: Record<string, unknown> = { ...mergedTop };
  if (allow.size > 0 || Object.keys(permRest).length > 0) {
    const permissions: Record<string, unknown> = { ...permRest };
    if (allow.size > 0) {
      permissions.allow = [...allow];
    }
    out.permissions = permissions;
  }

  const parsed = settingsSchema.safeParse(out);
  return parsed.success ? parsed.data : (out as Settings);
}

export class SettingsLoader {
  private readonly helixentHome: string;

  constructor(helixentHome: string = defaultHelixentHome()) {
    this.helixentHome = helixentHome;
  }

  userSettingsPath(): string {
    return join(this.helixentHome, "settings.json");
  }

  projectSettingsPath(cwd: string): string {
    return join(cwd, ".helixent", "settings.json");
  }

  projectLocalSettingsPath(cwd: string): string {
    return join(cwd, ".helixent", "settings.local.json");
  }

  async load(cwd: string): Promise<Settings> {
    const paths = [
      this.userSettingsPath(),
      this.projectSettingsPath(cwd),
      this.projectLocalSettingsPath(cwd),
    ];
    const layers = await Promise.all(paths.map((p) => loadLayer(p)));
    return mergeSettingsLayers(layers);
  }

  async loadAllowList(cwd: string): Promise<Set<string>> {
    const s = await this.load(cwd);
    const list = s.permissions?.allow;
    return new Set(Array.isArray(list) ? list : []);
  }
}
