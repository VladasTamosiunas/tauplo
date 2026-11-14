const VILNIUS_DATE = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Vilnius",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Calendar day in Europe/Vilnius as `YYYY-MM-DD`. A streak day rolls over at Vilnius midnight. */
export function vilniusDateKey(d: Date): string {
  return VILNIUS_DATE.format(d);
}

function dayNumber(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / 86_400_000;
}

export function nextStreak(
  prev: { count: number; lastKey: string | null },
  todayKey: string,
): { count: number; changed: boolean } {
  if (prev.lastKey === null) return { count: 1, changed: true };
  const gap = dayNumber(todayKey) - dayNumber(prev.lastKey);
  if (gap === 0) return { count: prev.count, changed: false };
  if (gap === 1) return { count: prev.count + 1, changed: true };
  return { count: 1, changed: true };
}
