export function warnInvalidSkill(path: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  console.warn(`[helixent] Skipping invalid skill ${path}: ${message}`);
}
