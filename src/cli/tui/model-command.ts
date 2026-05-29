import type { ModelEntry } from "@/cli/config";

export type ModelSelectionResult =
  | { ok: true; entry: ModelEntry; message: string }
  | { ok: false; message: string };

export function resolveModelSelection({
  models,
  currentModelName,
  targetName,
}: {
  models: ModelEntry[];
  currentModelName: string;
  targetName: string;
}): ModelSelectionResult {
  const target = targetName.trim();
  if (!target) {
    return { ok: false, message: "No models configured. Run `helixent config model add` to add one." };
  }

  const entry = models.find((model) => model.name === target);
  if (!entry) {
    return {
      ok: false,
      message: `Model "${target}" not found. Run \`/model\` to choose from configured models.`,
    };
  }

  if (entry.name === currentModelName) {
    return {
      ok: false,
      message: `Already using model "${entry.name}".`,
    };
  }

  return {
    ok: true,
    entry,
    message: `Switched model to "${entry.name}" for this session.`,
  };
}
