import { describe, expect, it } from "vitest";
import { GAMES, getVoyage } from "./catalog";
import { DEFAULT_PICK, canSailOpen, marketOptions, replayVoyage, type MonthPick } from "./voyage-engine";
import { VOYAGE_YEARS, difficultyOf } from "./voyage-years";

const year = (f: (m: number) => Partial<MonthPick>): MonthPick[] => Array.from({ length: 12 }, (_, i) => ({ ...DEFAULT_PICK, ...f(i + 1) }));

const SLUGS = {
  gentle: "kursiu-mariu-kapitonas-pirmieji-metai",
  base: "kursiu-mariu-kapitonas",
  hard: "kursiu-mariu-kapitonas-sunkus-metai",
  stormy: "kursiu-mariu-kapitonas-audringi-metai",
} as const;
const get = (k: keyof typeof SLUGS) => getVoyage(SLUGS[k])!;

/** A careful player: saves tax and a cushion, refuses scams, never takes a loan, keeps to the coast. */
const careful = (insure: (m: number) => boolean = () => false) =>
  year((m) => ({ toTax: m <= 9 ? 0.25 : 0.1, toCushion: [4, 5, 6, 7, 8, 9].includes(m) ? 0.5 : 0.15, resistScam: true, insure: insure(m) }));
const carelessOneScam = () => year((m) => ({ toTax: m <= 9 ? 0.25 : 0.1, toCushion: [4, 5, 6, 7, 8, 9].includes(m) ? 0.5 : 0.15, resistScam: false }));
const reckless = () => year(() => ({ takeLoan: true }));

describe("the four years form a ladder", () => {
  it("there are four years, listed from easiest to hardest, each in the catalog", () => {
    expect(VOYAGE_YEARS.map((y) => y.slug)).toEqual([SLUGS.gentle, SLUGS.base, SLUGS.hard, SLUGS.stormy]);
    expect(VOYAGE_YEARS.map((y) => y.level)).toEqual([1, 2, 3, 4]);
    for (const y of VOYAGE_YEARS) {
      expect(GAMES.some((g) => g.slug === y.slug), y.slug).toBe(true);
      expect(y.name.length).toBeGreaterThan(3);
      expect(y.blurb.length).toBeGreaterThan(20);
    }
  });
  it("difficultyOf maps a slug to its level and is 0 for anything else", () => {
    expect(difficultyOf(SLUGS.gentle)).toBe(1);
    expect(difficultyOf(SLUGS.stormy)).toBe(4);
    expect(difficultyOf("nera-tokio")).toBe(0);
  });
  /** How much of a good year's money one fallen-for scam costs. This is the margin for error. */
  const scamShare = (k: keyof typeof SLUGS) => {
    const v = get(k);
    const save = (m: number) => ({ toTax: m <= 9 ? 0.25 : 0.1, toCushion: [4, 5, 6, 7, 8, 9].includes(m) ? 0.5 : 0.15 });
    const good = replayVoyage(v, year((m) => ({ ...save(m), resistScam: true }))).netWorth;
    const fell = replayVoyage(v, year((m) => ({ ...save(m), resistScam: false }))).netWorth;
    return (good - fell) / good;
  };
  it("the margin for error shrinks along the survival years: one mistake costs a larger share each level", () => {
    expect(scamShare("base")).toBeGreaterThan(scamShare("gentle"));
    expect(scamShare("hard")).toBeGreaterThan(scamShare("base"));
  });
  it("careful play earns less money as the survival years get harder", () => {
    const net = (k: keyof typeof SLUGS) => replayVoyage(get(k), careful()).netWorth;
    expect(net("gentle")).toBeGreaterThan(net("base"));
    expect(net("base")).toBeGreaterThan(net("hard"));
  });
  it("the hard year costs the most when a careful player slips: the score drops furthest", () => {
    const drop = (k: keyof typeof SLUGS) => replayVoyage(get(k), careful()).score.iq - replayVoyage(get(k), carelessOneScam()).score.iq;
    expect(drop("hard")).toBeGreaterThan(drop("base"));
    expect(drop("hard")).toBeGreaterThan(drop("gentle"));
  });
});

describe.each(Object.entries(SLUGS))("%s year is a fair game", (_name, slug) => {
  const v = getVoyage(slug)!;

  it("is valid content with twelve months, a known port and event in each", () => {
    expect(v.months).toHaveLength(12);
    const ports = new Set(v.ports.map((p) => p.slug));
    for (const m of v.months) {
      expect(ports.has(m.port)).toBe(true);
      expect(m.event in v.events).toBe(true);
    }
  });
  it("can be won by a careful player: no shortfall, the winter survived, a good score", () => {
    const r = replayVoyage(v, careful((m) => v.months[m - 1].event === "engine-repair"));
    expect(r.survivedWinter).toBe(true);
    expect(r.totals.shortfall).toBe(0);
    expect(r.score.iq).toBeGreaterThanOrEqual(75);
  });
  it("punishes spending everything: the winter is lost and the score is low", () => {
    const r = replayVoyage(v, reckless());
    expect(r.survivedWinter).toBe(false);
    expect(r.score.iq).toBeLessThanOrEqual(35);
  });
  it("saving nothing is clearly worse than saving", () => {
    const none = replayVoyage(v, year(() => ({ resistScam: true })));
    expect(none.score.iq).toBeLessThan(replayVoyage(v, careful()).score.iq - 15);
  });
  it("conserves money, with premiums, claims and interest included", () => {
    for (const picks of [careful(() => true), carelessOneScam(), reckless(), year(() => ({ route: "open" as const, insure: true }))]) {
      const r = replayVoyage(v, picks);
      const t = r.totals;
      const pots = r.final.cash + r.final.tax + r.final.cushion;
      const arrived = v.start.cash + v.start.tax + v.start.cushion + t.income + t.loanTaken + t.claimed + t.interestEarned;
      const due = t.fixedCosts + t.eventCosts + t.weatherCosts + t.premiums + t.interest + t.installments + t.taxDue + t.taxPenalty + t.gearBought + t.wants;
      expect(pots).toBeCloseTo(arrived - (due - t.shortfall), 0);
    }
  });
  it("has at least one scam to refuse and at least one month the lagoon is frozen", () => {
    expect(v.months.some((m) => v.events[m.event].scam)).toBe(true);
    expect(v.months.some((m) => m.frozen)).toBe(true);
  });
  it("has a forecast that is usually right and wrong at least once", () => {
    expect(v.months.some((m) => m.forecast !== m.weather)).toBe(true);
    expect(v.months.filter((m) => m.forecast === m.weather).length).toBeGreaterThan(6);
  });
  it("has open water that can be sailed in at least four months", () => {
    expect(v.months.filter((_, i) => canSailOpen(v, i)).length).toBeGreaterThanOrEqual(4);
  });
});

describe("the gentle year (pirmieji metai) forgives a first mistake", () => {
  const v = get("gentle");
  it("a careful player who falls for one scam still gets through the winter", () => {
    const r = replayVoyage(v, carelessOneScam());
    expect(r.survivedWinter).toBe(true);
  });
  it("is easy enough that a player who saves only a little tax and a little cushion still survives", () => {
    const r = replayVoyage(v, year((m) => ({ toTax: 0.2, toCushion: m >= 4 && m <= 9 ? 0.2 : 0.05, resistScam: true })));
    expect(r.survivedWinter).toBe(true);
  });
});

describe("the stormy year (audringi metai) makes insurance matter", () => {
  const v = get("stormy");
  const repairs = v.months.map((m, i) => ({ m, i })).filter(({ m }) => v.events[m.event].cost && !v.events[m.event].scam);
  const insureRepairs = (m: number) => repairs.some(({ i }) => i + 1 === m);
  const sailStorms = (insure: boolean) =>
    year((m) => ({ toTax: m <= 9 ? 0.25 : 0.1, toCushion: [4, 5, 6, 7, 8, 9].includes(m) ? 0.5 : 0.15, resistScam: true, insure: insure && insureRepairs(m) }));

  it("has more stormy months than the base year", () => {
    const storms = (y: typeof v) => y.months.filter((m) => m.weather === "storm").length;
    expect(storms(v)).toBeGreaterThan(storms(get("base")));
  });
  it("has more than one costly repair, so cover can pay off more than once", () => {
    expect(repairs.length).toBeGreaterThanOrEqual(2);
    expect(v.months.filter((m) => v.events[m.event].surprise).length).toBeGreaterThanOrEqual(1);
  });
  it("insuring the repair months beats going without, for a careful player", () => {
    const covered = replayVoyage(v, sailStorms(true));
    const bare = replayVoyage(v, sailStorms(false));
    expect(covered.netWorth).toBeGreaterThan(bare.netWorth);
    expect(covered.totals.claimed).toBeGreaterThan(covered.totals.premiums);
  });
  it("chasing open water without cover loses money against staying on the coast", () => {
    const base = (route: "coast" | "open") =>
      year((m) => ({ route: route === "open" && canSailOpen(v, m - 1) ? ("open" as const) : ("coast" as const), toTax: 0.25, toCushion: [4, 5, 6, 7, 8, 9].includes(m) ? 0.4 : 0.15, resistScam: true }));
    expect(replayVoyage(v, base("open")).netWorth).toBeLessThan(replayVoyage(v, base("coast")).netWorth);
  });
});

/**
 * The market has to be a decision, not a free bonus and not a trap: a player who reads the prices must clearly beat one
 * who stays home, and a player who travels without reading them must not do better than staying home.
 */
describe.each(Object.entries(SLUGS))("%s year: the market rewards reading it", (_name, slug) => {
  const v = getVoyage(slug)!;
  const sensible = (extra: (m: number) => Partial<MonthPick>) =>
    year((m) => ({ toTax: m <= 9 ? 0.25 : 0.1, toCushion: [4, 5, 6, 7, 8, 9].includes(m) ? 0.4 : 0.15, resistScam: true, insure: v.months[m - 1].event === "engine-repair", ...extra(m) }));
  const stayHome = replayVoyage(v, sensible(() => ({}))).netWorth;
  const readsPrices = () =>
    replayVoyage(
      v,
      sensible((m) => {
        const best = marketOptions(v, 1, m - 1, "coast").filter((o) => !o.home).sort((a, b) => b.net - a.net)[0];
        return best && best.net > 0 ? { market: best.port } : {};
      }),
    );
  /** Deterministic pseudo-random players, so the test never flakes. */
  const randomPlayers = () => {
    const out: number[] = [];
    for (let seed = 1; seed <= 100; seed++) {
      let x = seed;
      const rnd = () => (x = (x * 1664525 + 1013904223) % 4294967296) / 4294967296;
      const r = replayVoyage(
        v,
        sensible((m) => {
          const others = Object.keys(v.markets!.prices[m - 1]);
          return rnd() < 0.5 ? { market: others[Math.floor(rnd() * others.length)] } : {};
        }),
      );
      out.push(r.netWorth - stayHome);
    }
    return out;
  };

  it("offers a market, with prices for the two other ports every month", () => {
    expect(v.markets).toBeDefined();
    for (const month of v.markets!.prices) expect(Object.keys(month)).toHaveLength(2);
  });
  it("a player who reads the prices earns clearly more than one who stays home, and still wins the year", () => {
    const r = readsPrices();
    expect(r.netWorth - stayHome).toBeGreaterThan(300);
    expect(r.survivedWinter).toBe(true);
    expect(r.totals.shortfall).toBe(0);
  });
  it("travelling without reading the prices does not pay: the average random traveller is no better off than staying home", () => {
    const outcomes = randomPlayers();
    const mean = outcomes.reduce((n, x) => n + x, 0) / outcomes.length;
    expect(mean).toBeLessThan(0);
  });
  it("is a real choice: some months the best port pays for the trip, and some months staying home is best", () => {
    const best = v.months.map((_, i) => Math.max(...marketOptions(v, 1, i, "coast").filter((o) => !o.home).map((o) => o.net)));
    expect(best.filter((n) => n > 0).length).toBeGreaterThanOrEqual(4);
    expect(best.filter((n) => n <= 0).length).toBeGreaterThanOrEqual(3);
  });
  it("the best port changes through the year: no single port is the best choice in every month that is worth travelling", () => {
    const winners = new Set(
      v.months
        .map((_, i) => marketOptions(v, 1, i, "coast").filter((o) => !o.home).sort((a, b) => b.net - a.net)[0])
        .filter((o) => o.net > 0)
        .map((o) => o.port),
    );
    expect(winners.size).toBeGreaterThanOrEqual(3);
  });
});
