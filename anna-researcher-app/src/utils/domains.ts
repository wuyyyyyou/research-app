export function parseDomains(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function clampProgress(progress: number | undefined): number {
  return Math.max(0, Math.min(100, progress ?? 0));
}
