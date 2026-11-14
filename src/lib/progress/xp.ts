/** Total XP at which `level` begins: 0, 100, 300, 600, ... */
export function xpForLevel(level: number): number {
  return 50 * level * (level - 1);
}

export type LevelInfo = {
  level: number;
  xpIntoLevel: number;
  /** XP span of the current level (distance to the next level). */
  xpForNext: number;
  /** 0 to 1 */
  progress: number;
};

export function levelFromXp(xp: number): LevelInfo {
  const safe = Math.max(0, Math.floor(xp));
  let level = 1;
  while (xpForLevel(level + 1) <= safe) level++;
  const start = xpForLevel(level);
  const span = xpForLevel(level + 1) - start;
  const xpIntoLevel = safe - start;
  return { level, xpIntoLevel, xpForNext: span, progress: xpIntoLevel / span };
}
