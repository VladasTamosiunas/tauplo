import { DEFAULT_PICK, type MonthPick, type VoyageResult } from "./voyage-engine";

/**
 * The picks and the projection used to pin the engine's results. Shared by the generator and the test so the two can
 * never describe different things. Only fields that existed before the deposit and market rules are projected, so
 * adding new record fields does not disturb the pin; changing any of THESE results does.
 */

export const GOLDEN_SLUGS = [
  "kursiu-mariu-kapitonas-pirmieji-metai",
  "kursiu-mariu-kapitonas",
  "kursiu-mariu-kapitonas-sunkus-metai",
  "kursiu-mariu-kapitonas-audringi-metai",
] as const;

const year = (make: (m: number) => Partial<MonthPick>): MonthPick[] => Array.from({ length: 12 }, (_, i) => ({ ...DEFAULT_PICK, ...make(i + 1) }));

export const GOLDEN_PICKS: Record<string, () => MonthPick[]> = {
  prudent: () =>
    year((m) => ({ toTax: m <= 9 ? 0.25 : 0.1, toCushion: [5, 6, 7, 8].includes(m) ? 0.4 : 0.1, resistScam: true, upgradeGear: m === 7 })),
  reckless: () => year(() => ({ takeLoan: true })),
  mixed: () =>
    year((m) => ({
      toTax: 0.2,
      toCushion: m >= 4 && m <= 9 ? 0.35 : 0.1,
      route: m % 2 === 0 ? ("open" as const) : ("coast" as const),
      insure: m === 3 || m === 9 || m === 10,
      takeLoan: m === 3,
      resistScam: m % 3 !== 0,
      upgradeGear: m === 5,
    })),
};

export function project(r: VoyageResult) {
  return {
    netWorth: r.netWorth,
    iq: r.score.iq,
    survivedWinter: r.survivedWinter,
    shortfall: r.totals.shortfall,
    months: r.months.map((m) => [m.income, m.cash, m.tax, m.cushion, m.debt, m.gear, m.shortfall, m.wants, m.premium, m.claimed, m.interestEarned]),
  };
}
