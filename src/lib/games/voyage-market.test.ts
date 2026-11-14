import { describe, expect, it } from "vitest";
import { InvalidPicksError } from "../errors";
import { formatEur } from "../format";
import { getVoyage } from "./catalog";
import type { Voyage } from "./schema";
import { DEFAULT_PICK, depositPreview, incomeFor, initialState, marketOptions, playMonth, replayVoyage, type MonthPick } from "./voyage-engine";

/**
 * The market: each month the catch can be sold at the month's home port (the normal price, no trip) or at another port
 * whose price changes month by month, for the cost of the trip. These tests set the prices themselves so they pin the
 * RULE, not the balance numbers chosen for each year.
 */

const base = getVoyage("kursiu-mariu-kapitonas")!;
const PORTS = base.ports.map((p) => p.slug);
const home = (i: number) => base.months[i].port;
const others = (i: number) => PORTS.filter((p) => p !== home(i));
/** The first other port pays 20 % more in even months and 10 % less in odd ones; the second port the other way round. */
const rich = (i: number) => others(i)[i % 2 === 0 ? 0 : 1];
const poor = (i: number) => others(i)[i % 2 === 0 ? 1 : 0];
const prices = Array.from({ length: 12 }, (_, i) => ({ [home(i)]: 1, [rich(i)]: 1.2, [poor(i)]: 0.9 }));
const v: Voyage = { ...base, markets: { travelCost: 60, prices } };

const year = (make: (m: number) => Partial<MonthPick>): MonthPick[] => Array.from({ length: 12 }, (_, i) => ({ ...DEFAULT_PICK, ...make(i + 1) }));
const careful = (m: number): Partial<MonthPick> => ({ toTax: 0.25, toCushion: [4, 5, 6, 7, 8, 9].includes(m) ? 0.4 : 0.15, resistScam: true });

describe("selling at the home port", () => {
  it("is the normal price with no trip, whether the market is left out or named", () => {
    const st = initialState(v);
    const left = playMonth(v, st, DEFAULT_PICK, 6);
    const named = playMonth(v, st, { ...DEFAULT_PICK, market: home(6) }, 6);
    expect(named.record).toEqual(left.record);
    expect(left.record.market).toBe(home(6));
    expect(left.record.priceMultiplier).toBe(1);
    expect(left.record.travelCost).toBe(0);
    expect(left.record.marketNet).toBe(0);
  });
  it("a whole year naming the home port every month equals a year naming nothing", () => {
    const named = replayVoyage(v, year((m) => ({ ...careful(m), market: home(m - 1) })));
    const left = replayVoyage(v, year(careful));
    expect(named.netWorth).toBe(left.netWorth);
    expect(named.totals.income).toBe(left.totals.income);
  });
});

describe("selling at another port", () => {
  it("multiplies the month's income by that port's price and charges the trip", () => {
    const st = initialState(v);
    const r = playMonth(v, st, { ...DEFAULT_PICK, market: rich(6) }, 6).record;
    const homeIncome = incomeFor(v, 1, 6);
    expect(r.market).toBe(rich(6));
    expect(r.priceMultiplier).toBe(1.2);
    expect(r.income).toBeCloseTo(homeIncome * 1.2, 1);
    expect(r.income).toBe(incomeFor(v, 1, 6, "coast", rich(6)));
    expect(r.travelCost).toBe(60);
    expect(r.marketNet).toBeCloseTo(r.income - homeIncome - 60, 1);
  });
  it("a worse price is a real loss: the player earns less and still pays for the trip", () => {
    const st = initialState(v);
    const r = playMonth(v, st, { ...DEFAULT_PICK, market: poor(6) }, 6).record;
    expect(r.priceMultiplier).toBe(0.9);
    expect(r.income).toBeLessThan(incomeFor(v, 1, 6));
    expect(r.marketNet).toBeLessThan(-60);
  });
  it("the trip is a bill like any other: with no money in reserve it goes unpaid and shows as a shortfall", () => {
    const empty = { ...initialState(v), cash: 0, cushion: 0 };
    const stayed = playMonth(v, empty, DEFAULT_PICK, 0).record;
    const went = playMonth(v, empty, { ...DEFAULT_PICK, market: poor(0) }, 0).record;
    expect(went.shortfall - stayed.shortfall).toBeCloseTo(60 + incomeFor(v, 1, 0) * 0.1, 0);
  });
  it("is added on top of the open-water multiplier, not instead of it", () => {
    const open = incomeFor(v, 1, 6, "open");
    expect(incomeFor(v, 1, 6, "open", rich(6))).toBeCloseTo(open * 1.2, 1);
  });
  it("raises the tax owed with the income, because tax is a share of what was earned", () => {
    const st = initialState(v);
    const stayed = playMonth(v, st, DEFAULT_PICK, 6).state.liability;
    const went = playMonth(v, st, { ...DEFAULT_PICK, market: rich(6) }, 6).state.liability;
    expect(went / stayed).toBeCloseTo(1.2, 1);
  });
  it("totals add up the trips", () => {
    const r = replayVoyage(v, year((m) => ({ ...careful(m), market: m === 6 || m === 7 ? rich(m - 1) : undefined })));
    expect(r.totals.travelCosts).toBe(120);
  });
});

describe("money is conserved with trips", () => {
  it("every euro earned, spent on the trip or left unpaid is accounted for", () => {
    for (const picks of [
      year((m) => ({ ...careful(m), market: m >= 5 && m <= 8 ? rich(m - 1) : undefined })),
      year((m) => ({ ...careful(m), market: poor(m - 1) })),
      year((m) => ({ toTax: 0.1, market: m % 2 === 0 ? rich(m - 1) : undefined, takeLoan: m === 2 })),
    ]) {
      const r = replayVoyage(v, picks);
      const t = r.totals;
      const pots = r.final.cash + r.final.tax + r.final.cushion;
      const arrived = v.start.cash + v.start.tax + v.start.cushion + t.income + t.loanTaken + t.claimed + t.interestEarned + t.depositInterest;
      const due = t.fixedCosts + t.eventCosts + t.weatherCosts + t.premiums + t.interest + t.installments + t.taxDue + t.taxPenalty + t.gearBought + t.wants + t.travelCosts;
      expect(pots + r.final.locked.reduce((n, d) => n + d.amount, 0)).toBeCloseTo(arrived - (due - t.shortfall), 0);
    }
  });
});

describe("marketOptions: what the player is told before choosing", () => {
  it("lists every port, marks the home port, and gives the real income and net gain of each", () => {
    const opts = marketOptions(v, 1, 6, "coast");
    expect(opts.map((o) => o.port).sort()).toEqual([...PORTS].sort());
    const h = opts.find((o) => o.home)!;
    expect(h.port).toBe(home(6));
    expect(h.price).toBe(1);
    expect(h.travelCost).toBe(0);
    expect(h.net).toBe(0);
    const r = opts.find((o) => o.port === rich(6))!;
    expect(r.price).toBe(1.2);
    expect(r.travelCost).toBe(60);
    expect(r.net).toBeCloseTo(r.income - h.income - 60, 1);
  });
  it("agrees with what the engine books, for every port, in every month of a year", () => {
    let st = initialState(v);
    for (let i = 0; i < 12; i++) {
      const pick = { ...DEFAULT_PICK, ...careful(i + 1) };
      for (const o of marketOptions(v, st.gear, i, "coast")) {
        const real = playMonth(v, st, { ...pick, market: o.port }, i).record;
        expect(real.income, `month ${i + 1} ${o.port}`).toBe(o.income);
        expect(real.travelCost).toBe(o.travelCost);
        expect(real.marketNet).toBeCloseTo(o.net, 1);
      }
      st = playMonth(v, st, pick, i).state;
    }
  });
  it("names the ports with their display names", () => {
    for (const o of marketOptions(v, 1, 3, "coast")) expect(o.name).toBe(base.ports.find((p) => p.slug === o.port)!.name);
  });
  it("is empty when the voyage has no markets", () => {
    // built explicitly without the field, so this keeps meaning "not offered" whatever the shipped years do
    const { markets: _offered, ...rest } = base;
    void _offered;
    const without: Voyage = rest;
    expect(without.markets).toBeUndefined();
    expect(marketOptions(without, 1, 3, "coast")).toEqual([]);
  });
});

describe("the deposit preview follows the market", () => {
  it("shows the figures of the month the market choice will really book, not the home month", () => {
    const st = { ...initialState(v), cash: 3000 };
    const pick = { ...DEFAULT_PICK, toTax: 0.25, toCushion: 0.3, deposit: 0.2, market: rich(6) };
    const shown = depositPreview(v, st, pick, 6);
    const real = playMonth(v, st, pick, 6).record;
    expect(shown.available).toBeCloseTo(real.income + real.maturedAmount + real.depositInterest, 2);
    expect(shown.setAside).toBeCloseTo(real.toTaxAmount + real.toCushionAmount + real.depositedAmount, 2);
    expect(shown.locked).toBeCloseTo(real.depositedAmount, 2);
    // and it differs from the home preview, so the test cannot pass by ignoring the market
    expect(shown.available).not.toBeCloseTo(depositPreview(v, st, { ...pick, market: undefined }, 6).available, 0);
  });
});

describe("a voyage with no markets", () => {
  const { markets: _unused, ...rest } = v;
  void _unused;
  const plain: Voyage = rest;
  it("ignores a market pick completely: same income, no trip, home port in the record", () => {
    expect(plain.markets).toBeUndefined();
    const a = replayVoyage(plain, year((m) => ({ ...careful(m), market: nidaOrOther(m) })));
    const b = replayVoyage(plain, year(careful));
    expect(a.netWorth).toBe(b.netWorth);
    expect(a.totals.travelCosts).toBe(0);
    expect(a.months.every((r, i) => r.market === plain.months[i].port)).toBe(true);
  });
  function nidaOrOther(m: number) {
    return rich(m - 1);
  }
});

describe("tampered picks", () => {
  it("rejects a market that is not a port of this voyage, not a string, or empty", () => {
    for (const bad of ["tokio", 7, null, "", "KLAIPEDA", ["nida"]]) {
      const picks = year(() => ({})).map((p, i) => (i === 5 ? { ...p, market: bad } : p));
      expect(() => replayVoyage(v, picks), String(bad)).toThrow(InvalidPicksError);
    }
  });
  it("still accepts picks from a client that predates the market (the field is missing)", () => {
    const old = year(careful).map((p) => {
      const copy: Partial<MonthPick> = { ...p };
      delete copy.market;
      return copy;
    });
    expect(() => replayVoyage(v, old)).not.toThrow();
  });
});

describe("lessons about the market", () => {
  const mentions = (r: ReturnType<typeof replayVoyage>) => r.lessons.filter((l) => /kelion/i.test(l));
  const money = (n: number) => formatEur(n);

  it("says nothing to a player who never travelled and had nothing worth travelling for", () => {
    const flat: Voyage = { ...v, markets: { travelCost: 60, prices: prices.map((p) => Object.fromEntries(Object.keys(p).map((k) => [k, 1]))) } };
    expect(mentions(replayVoyage(flat, year(careful)))).toEqual([]);
  });
  it("tells a player their trips paid, with the gain after the cost of the trips", () => {
    const r = replayVoyage(v, year((m) => ({ ...careful(m), market: m >= 5 && m <= 8 ? rich(m - 1) : undefined })));
    const gained = r.months.reduce((n, x) => n + x.marketNet, 0);
    expect(gained).toBeGreaterThan(0);
    const l = mentions(r);
    expect(l.join(" ")).toContain(money(gained));
  });
  it("warns a player who travelled for a worse price, and says how much it cost", () => {
    const r = replayVoyage(v, year((m) => ({ ...careful(m), market: poor(m - 1) })));
    const lost = r.months.reduce((n, x) => n + Math.min(0, x.marketNet), 0);
    expect(lost).toBeLessThan(0);
    expect(mentions(r).join(" ")).toContain(money(-lost));
  });
  it("points out a better port the player skipped, when the gain beat the cost of the trip", () => {
    const stayed = replayVoyage(v, year(careful));
    const l = mentions(stayed).join(" ");
    expect(l).toMatch(/praleid/i);
  });
  it("uses no em-dash or en-dash and gives at most three market lessons", () => {
    for (const picks of [year(careful), year((m) => ({ ...careful(m), market: poor(m - 1) })), year((m) => ({ ...careful(m), market: rich(m - 1) }))]) {
      const l = mentions(replayVoyage(v, picks));
      expect(l.length).toBeLessThanOrEqual(3);
      for (const s of l) expect(s).not.toMatch(/[–—]/);
    }
  });
});
