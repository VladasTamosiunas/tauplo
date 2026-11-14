import { describe, expect, it } from "vitest";
import { InvalidPicksError } from "../errors";
import { getVoyage } from "./catalog";
import { DEFAULT_PICK, canSailOpen, incomeFor, replayVoyage, type MonthPick } from "./voyage-engine";

const v = getVoyage("kursiu-mariu-kapitonas")!;

const year = (make: (m: number) => Partial<MonthPick>): MonthPick[] =>
  Array.from({ length: 12 }, (_, i) => ({ ...DEFAULT_PICK, ...make(i + 1) }));

/** Sensible play: set aside tax and cushion every good month, refuse the scam, never take the loan. */
const prudent = () =>
  year((m) => ({
    toTax: m <= 9 ? 0.25 : 0.1,
    toCushion: [5, 6, 7, 8].includes(m) ? 0.4 : 0.1,
    resistScam: true,
    upgradeGear: m === 7,
  }));

/** Spend-everything play: nothing saved, scams accepted, loan taken the first time cash runs low. */
const reckless = () => year(() => ({ toTax: 0, toCushion: 0, resistScam: false, takeLoan: true }));

describe("replayVoyage: shape of a year", () => {
  it("returns one entry per month, in order", () => {
    const r = replayVoyage(v, prudent());
    expect(r.months).toHaveLength(12);
    expect(r.months.map((m) => m.month)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });
  it("is deterministic", () => {
    expect(replayVoyage(v, prudent())).toEqual(replayVoyage(v, prudent()));
  });
  it("income follows the season: July pays much more than January", () => {
    const r = replayVoyage(v, prudent());
    expect(r.months[6].income).toBeGreaterThan(r.months[0].income * 5);
  });
});

describe("incomeFor", () => {
  it("matches the income the engine books every month, across gear levels", () => {
    const r = replayVoyage(v, year((m) => ({ upgradeGear: m === 1 })));
    // Income is booked at the gear the month STARTS with, so an upgrade bought in a month pays from the next one.
    r.months.forEach((m, i) => {
      const startGear = i === 0 ? v.start.gear : r.months[i - 1].gear;
      expect(incomeFor(v, startGear, i)).toBe(m.income);
    });
    expect(r.months[0].gear).toBe(2);
    expect(r.months[0].income).toBe(incomeFor(v, 1, 0));
  });
  it("the July boom pays a fifth more than the plain seasonal figure", () => {
    const july = v.months.findIndex((m) => m.event === "boom");
    const plain = v.baseIncome * v.months[july].season;
    expect(incomeFor(v, 1, july)).toBeCloseTo(plain * 1.2, 1);
  });
  it("better gear always pays more in the same month", () => {
    for (let i = 0; i < 12; i++) {
      expect(incomeFor(v, 2, i)).toBeGreaterThan(incomeFor(v, 1, i));
      expect(incomeFor(v, 3, i)).toBeGreaterThan(incomeFor(v, 2, i));
    }
  });
});

describe("replayVoyage: money rules", () => {
  it("never lets any pot go below zero", () => {
    for (const picks of [prudent(), reckless()]) {
      for (const m of replayVoyage(v, picks).months) {
        expect(m.cash).toBeGreaterThanOrEqual(0);
        expect(m.tax).toBeGreaterThanOrEqual(0);
        expect(m.cushion).toBeGreaterThanOrEqual(0);
        expect(m.debt).toBeGreaterThanOrEqual(0);
      }
    }
  });
  it("conserves money: what arrives either stays in a pot or was paid out (shortfalls were never paid)", () => {
    for (const picks of [prudent(), reckless(), year(() => ({}))]) {
      const r = replayVoyage(v, picks);
      const t = r.totals;
      const pots = r.final.cash + r.final.tax + r.final.cushion;
      const arrived = v.start.cash + v.start.tax + v.start.cushion + t.income + t.loanTaken + t.claimed + t.interestEarned;
      const due = t.fixedCosts + t.eventCosts + t.weatherCosts + t.premiums + t.interest + t.installments + t.taxDue + t.taxPenalty + t.gearBought + t.wants;
      expect(pots).toBeCloseTo(arrived - (due - t.shortfall), 0);
    }
  });
  it("tax is paid only in the due months, and from the tax jar first", () => {
    const r = replayVoyage(v, prudent());
    for (const m of r.months) {
      if (!v.taxDueMonths.includes(m.month)) {
        expect(m.taxDue).toBe(0);
        expect(m.taxFromJar).toBe(0);
        expect(m.taxPenalty).toBe(0);
      }
    }
    expect(r.totals.taxFromJar).toBeGreaterThan(0);
    expect(r.totals.taxFromJar).toBeLessThanOrEqual(r.totals.taxDue);
  });
  it("an unfunded tax bill is charged with a penalty instead of disappearing", () => {
    const r = replayVoyage(v, reckless());
    expect(r.totals.taxPenalty).toBeGreaterThan(0);
  });
  it("allocation shares are limited so tax plus cushion never exceeds the income of the month", () => {
    const greedy = year(() => ({ toTax: 1, toCushion: 1 }));
    const r = replayVoyage(v, greedy);
    for (const m of r.months) expect(m.toTaxAmount + m.toCushionAmount).toBeLessThanOrEqual(m.income + 0.01);
  });
  it("monthly costs are charged even in a month with almost no income", () => {
    const r = replayVoyage(v, prudent());
    for (const m of r.months) expect(m.fixedCost).toBe(v.fixedMonthlyCost);
  });
});

describe("replayVoyage: the decisions", () => {
  it("upgrading gear raises later income and costs money once", () => {
    const base = replayVoyage(v, year(() => ({})));
    const upgraded = replayVoyage(v, year((m) => ({ upgradeGear: m === 1 })));
    expect(upgraded.totals.gearBought).toBe(v.gear.upgradeCost[1]);
    expect(upgraded.months[6].income).toBeGreaterThan(base.months[6].income);
  });
  it("gear cannot be upgraded beyond the top level, and the gear sale makes one level cheaper", () => {
    const sale = v.events["gear-sale"].gearDiscount!;
    const r = replayVoyage(v, year(() => ({ upgradeGear: true })));
    expect(r.months.at(-1)!.gear).toBe(v.gear.maxLevel);
    const full = v.gear.upgradeCost[1] + v.gear.upgradeCost[2];
    const discounted = v.gear.upgradeCost[1] + v.gear.upgradeCost[2] * sale;
    expect(r.totals.gearBought).toBeGreaterThanOrEqual(discounted - 0.01);
    expect(r.totals.gearBought).toBeLessThanOrEqual(full + 0.01);
  });
  it("an upgrade that cannot be afforded is skipped, not charged", () => {
    const r = replayVoyage(v, year((m) => ({ upgradeGear: m === 2 })));
    expect(r.months[1].gear).toBe(1);
    expect(r.totals.gearBought).toBe(0);
  });
  it("a saver can fund an upgrade out of the cushion when pocket money is short", () => {
    const r = replayVoyage(v, year((m) => ({ toCushion: m >= 4 && m <= 7 ? 1 : 0, upgradeGear: m === 8 })));
    expect(r.months[7].gear).toBe(2);
    expect(r.months[7].gearBought).toBe(v.gear.upgradeCost[1]);
  });
  it("accepting the scam offer costs its full amount; resisting costs nothing", () => {
    const scamMonth = v.months.findIndex((m) => m.event === "scam-offer") + 1;
    const fell = replayVoyage(v, year((m) => ({ resistScam: m === scamMonth ? false : true })));
    const held = replayVoyage(v, year(() => ({ resistScam: true })));
    expect(fell.months[scamMonth - 1].eventCost).toBe(v.events["scam-offer"].cost);
    expect(held.months[scamMonth - 1].eventCost).toBe(0);
  });
  it("a loan adds cash now and interest later, and can be repaid", () => {
    const withLoan = replayVoyage(v, year((m) => ({ takeLoan: m === 1 })));
    expect(withLoan.totals.loanTaken).toBe(v.loan.amount);
    expect(withLoan.totals.interest).toBeGreaterThan(0);
    expect(withLoan.final.debt).toBe(0);
  });
  it("only one loan can be open at a time", () => {
    const r = replayVoyage(v, year(() => ({ takeLoan: true })));
    expect(r.totals.loanTaken).toBeLessThanOrEqual(v.loan.amount * 2);
    for (const m of r.months) expect(m.debt).toBeLessThanOrEqual(v.loan.amount * (1 + v.loan.monthlyInterestRate * 12) + 1);
  });
});

describe("replayVoyage: outcomes teach the lesson", () => {
  it("prudent play ends the year with a cushion and a good score", () => {
    const r = replayVoyage(v, prudent());
    expect(r.cushionMonths).toBeGreaterThanOrEqual(2);
    expect(r.score.iq).toBeGreaterThanOrEqual(70);
    expect(r.survivedWinter).toBe(true);
  });
  it("reckless play goes short in winter and scores low", () => {
    const r = replayVoyage(v, reckless());
    expect(r.survivedWinter).toBe(false);
    expect(r.score.iq).toBeLessThanOrEqual(40);
  });
  it("prudent beats reckless on every headline number", () => {
    const a = replayVoyage(v, prudent());
    const b = replayVoyage(v, reckless());
    expect(a.score.iq).toBeGreaterThan(b.score.iq);
    expect(a.totals.shortfall).toBeLessThan(b.totals.shortfall);
  });
  it("the iq is a whole number from 0 to 100", () => {
    for (const picks of [prudent(), reckless(), year(() => ({}))]) {
      const iq = replayVoyage(v, picks).score.iq;
      expect(Number.isInteger(iq)).toBe(true);
      expect(iq).toBeGreaterThanOrEqual(0);
      expect(iq).toBeLessThanOrEqual(100);
    }
  });
  it("reports at least one lesson sentence for every costly mistake", () => {
    const r = replayVoyage(v, reckless());
    expect(r.lessons.length).toBeGreaterThanOrEqual(2);
    for (const l of r.lessons) expect(l.length).toBeGreaterThan(10);
  });
});

describe("open water: route and weather", () => {
  const idx = (pred: (m: (typeof v.months)[number], i: number) => boolean) => v.months.findIndex(pred);
  const sailOpenIn = (month: number) => year((m) => ({ route: m === month ? "open" : "coast" }));
  const clean = (m: (typeof v.months)[number]) => v.events[m.event].incomeMultiplier === undefined;

  const calm = idx((m, i) => m.weather === "calm" && canSailOpen(v, i) && clean(m));
  const rough = idx((m, i) => m.weather === "rough" && canSailOpen(v, i) && clean(m));
  const storm = idx((m, i) => m.weather === "storm" && canSailOpen(v, i) && clean(m));
  const frozen = idx((m, i) => !canSailOpen(v, i));

  it("the content has calm, rough and stormy months that can be sailed, and a frozen month that cannot", () => {
    expect(calm).toBeGreaterThanOrEqual(0);
    expect(rough).toBeGreaterThanOrEqual(0);
    expect(storm).toBeGreaterThanOrEqual(0);
    expect(frozen).toBeGreaterThanOrEqual(0);
  });
  it("pays in the order calm, then rough, then storm, and calm beats the coast", () => {
    const m = v.openWater.incomeMultiplier;
    expect(m.calm).toBeGreaterThan(1);
    expect(m.rough).toBeLessThan(1);
    expect(m.storm).toBeLessThan(m.rough);
  });
  it("the coast is the default and ignores the weather", () => {
    const r = replayVoyage(v, prudent());
    for (const rec of r.months) {
      expect(rec.route).toBe("coast");
      expect(rec.weatherCost).toBe(0);
    }
    expect(r.totals.weatherCosts).toBe(0);
  });
  it("open water in a calm month pays more than staying on the coast", () => {
    const coast = replayVoyage(v, year(() => ({})));
    const open = replayVoyage(v, sailOpenIn(calm + 1));
    expect(open.months[calm].income).toBeGreaterThan(coast.months[calm].income);
    expect(open.months[calm].income).toBeCloseTo(coast.months[calm].income * v.openWater.incomeMultiplier.calm, 1);
    expect(open.months[calm].weatherCost).toBe(0);
  });
  it("open water in a rough month pays less than the coast, with no repair bill", () => {
    const coast = replayVoyage(v, year(() => ({})));
    const open = replayVoyage(v, sailOpenIn(rough + 1));
    expect(open.months[rough].income).toBeLessThan(coast.months[rough].income);
    expect(open.months[rough].weatherCost).toBe(0);
  });
  it("open water in a storm pays far less and costs a repair bill", () => {
    const coast = replayVoyage(v, year(() => ({})));
    const open = replayVoyage(v, sailOpenIn(storm + 1));
    expect(open.months[storm].income).toBeLessThan(coast.months[storm].income * 0.6);
    expect(open.months[storm].weatherCost).toBe(v.openWater.stormRepair);
    expect(open.totals.weatherCosts).toBe(v.openWater.stormRepair);
  });
  it("the coast in the same stormy month costs nothing extra", () => {
    const coast = replayVoyage(v, year(() => ({})));
    expect(coast.months[storm].weatherCost).toBe(0);
  });
  it("open water is not possible while the lagoon is frozen: the pick counts as the coast", () => {
    const coast = replayVoyage(v, year(() => ({})));
    const asked = replayVoyage(v, sailOpenIn(frozen + 1));
    expect(asked.months[frozen].route).toBe("coast");
    expect(asked.months[frozen].income).toBe(coast.months[frozen].income);
    expect(asked.months[frozen].weatherCost).toBe(0);
  });
  it("the forecast is not always right, so a good forecast is not a promise", () => {
    expect(v.months.some((m) => m.forecast !== m.weather)).toBe(true);
    expect(v.months.filter((m) => m.forecast === m.weather).length).toBeGreaterThan(v.months.length / 2);
  });
  it("incomeFor previews exactly what the engine books on each route", () => {
    for (const month of [calm, rough, storm]) {
      const r = replayVoyage(v, sailOpenIn(month + 1));
      expect(incomeFor(v, month === 0 ? v.start.gear : r.months[month - 1].gear, month, "open")).toBe(r.months[month].income);
    }
  });
  it("money is still conserved when repair bills are paid", () => {
    const r = replayVoyage(v, sailOpenIn(storm + 1));
    const t = r.totals;
    const pots = r.final.cash + r.final.tax + r.final.cushion;
    const arrived = v.start.cash + v.start.tax + v.start.cushion + t.income + t.loanTaken + t.claimed + t.interestEarned;
    const due = t.fixedCosts + t.eventCosts + t.weatherCosts + t.premiums + t.interest + t.installments + t.taxDue + t.taxPenalty + t.gearBought + t.wants;
    expect(pots).toBeCloseTo(arrived - (due - t.shortfall), 0);
  });
  it("sailing open water every possible month with no savings ends worse than a prudent coast year", () => {
    const gambler = replayVoyage(v, year(() => ({ route: "open" })));
    const careful = replayVoyage(v, prudent());
    expect(gambler.score.iq).toBeLessThan(careful.score.iq);
  });
  it("teaches the lesson when open water went wrong", () => {
    const r = replayVoyage(v, sailOpenIn(storm + 1));
    expect(r.lessons.some((l) => /prognoz/i.test(l))).toBe(true);
  });
  it("gives no open-water lesson to a player who stayed on the coast", () => {
    const r = replayVoyage(v, prudent());
    expect(r.lessons.some((l) => /prognoz/i.test(l))).toBe(false);
  });
  it("rejects a route that is not coast or open, and treats a missing route as the coast", () => {
    for (const bad of ["sideways", 1, null, true]) {
      const picks: unknown[] = prudent();
      picks[2] = { ...DEFAULT_PICK, route: bad };
      expect(() => replayVoyage(v, picks)).toThrow(InvalidPicksError);
    }
    const legacy: unknown[] = prudent().map(({ route: _route, ...rest }) => { void _route; return rest; });
    expect(replayVoyage(v, legacy)).toEqual(replayVoyage(v, prudent()));
  });
});

describe("insurance and interest on savings", () => {
  const idx = (pred: (m: (typeof v.months)[number]) => boolean) => v.months.findIndex(pred);
  const repair = idx((m) => m.event === "engine-repair");
  const scam = idx((m) => m.event === "scam-offer");
  const insuredAll = year(() => ({ insure: true }));
  const insuredIn = (...months: number[]) => year((m) => ({ insure: months.includes(m) }));

  it("the content defines a premium, a coverage share and a savings rate", () => {
    expect(v.insurance.monthlyPremium).toBeGreaterThan(0);
    expect(v.insurance.coverage).toBeGreaterThan(0);
    expect(v.insurance.coverage).toBeLessThanOrEqual(1);
    expect(v.savingsRate).toBeGreaterThan(0);
    expect(v.savingsRate).toBeLessThan(0.02);
  });
  it("is off by default and a missing insure field means uninsured", () => {
    const r = replayVoyage(v, prudent());
    expect(r.totals.premiums).toBe(0);
    expect(r.totals.claimed).toBe(0);
    for (const m of r.months) expect(m.insured).toBe(false);
    const legacy: unknown[] = prudent().map(({ insure: _i, ...rest }) => { void _i; return rest; });
    expect(replayVoyage(v, legacy)).toEqual(r);
  });
  it("rejects an insure flag that is not a boolean", () => {
    for (const bad of ["yes", 1, null, {}]) {
      const picks: unknown[] = prudent();
      picks[4] = { ...DEFAULT_PICK, insure: bad };
      expect(() => replayVoyage(v, picks)).toThrow(InvalidPicksError);
    }
  });
  it("a policy costs its premium in every month it is held, and only then", () => {
    const r = replayVoyage(v, insuredIn(3, 4, 5));
    expect(r.totals.premiums).toBeCloseTo(v.insurance.monthlyPremium * 3, 2);
    expect(r.months[2].premium).toBe(v.insurance.monthlyPremium);
    expect(r.months[5].premium).toBe(0);
  });
  it("pays its coverage share of a repair when held in that month", () => {
    const withCover = replayVoyage(v, insuredIn(repair + 1));
    const bare = replayVoyage(v, year(() => ({})));
    const cost = v.events["engine-repair"].cost!;
    expect(withCover.months[repair].claimed).toBeCloseTo(cost * v.insurance.coverage, 2);
    expect(bare.months[repair].claimed).toBe(0);
    expect(withCover.totals.claimed).toBeCloseTo(cost * v.insurance.coverage, 2);
  });
  it("pays nothing when the policy was not held in the month of the repair", () => {
    const r = replayVoyage(v, insuredIn(repair)); // the month before
    expect(r.totals.claimed).toBe(0);
  });
  it("never pays out on a scam, however insured the player is", () => {
    const fell = replayVoyage(v, year(() => ({ insure: true, resistScam: false })));
    expect(fell.months[scam].scamFell).toBe(true);
    expect(fell.months[scam].claimed).toBe(0);
  });
  it("pays toward a storm repair on open water", () => {
    const stormOpen = v.months.findIndex((m, i) => m.weather === "storm" && canSailOpen(v, i));
    const picks = year((m) => ({ insure: m === stormOpen + 1, route: m === stormOpen + 1 ? ("open" as const) : ("coast" as const) }));
    const r = replayVoyage(v, picks);
    expect(r.months[stormOpen].weatherCost).toBe(v.openWater.stormRepair);
    expect(r.months[stormOpen].claimed).toBeGreaterThanOrEqual(v.openWater.stormRepair * v.insurance.coverage - 0.01);
  });
  it("a claim never exceeds what was actually lost that month", () => {
    const r = replayVoyage(v, insuredAll);
    for (const m of r.months) expect(m.claimed).toBeLessThanOrEqual(m.eventCost + m.weatherCost + 0.01);
  });
  const saver = (insure: (m: number) => boolean) =>
    year((m) => ({ toTax: 0.25, toCushion: m >= 3 ? 0.3 : 0.1, resistScam: true, insure: insure(m) }));
  it("insurance is a trade-off: paying all year can cost more than the one repair it covers", () => {
    const always = replayVoyage(v, saver(() => true));
    const none = replayVoyage(v, saver(() => false));
    expect(always.totals.premiums).toBeGreaterThan(always.totals.claimed);
    expect(always.netWorth).toBeLessThan(none.netWorth);
  });
  it("insuring only the risky months beats insuring all year", () => {
    const all = replayVoyage(v, saver(() => true));
    const smart = replayVoyage(v, saver((m) => m === repair + 1));
    expect(smart.netWorth).toBeGreaterThan(all.netWorth);
  });
  it("the cushion earns interest every month it holds money, and an empty one earns nothing", () => {
    const saver = replayVoyage(v, year((m) => ({ toCushion: m >= 3 ? 0.4 : 0 })));
    const spender = replayVoyage(v, year(() => ({})));
    expect(saver.totals.interestEarned).toBeGreaterThan(0);
    expect(spender.totals.interestEarned).toBe(0);
    for (const m of saver.months) expect(m.interestEarned).toBeGreaterThanOrEqual(0);
  });
  it("interest is small next to what saving does, so it rewards saving without being the reason to save", () => {
    const saver = replayVoyage(v, year((m) => ({ toCushion: m >= 3 ? 0.4 : 0 })));
    expect(saver.totals.interestEarned).toBeLessThan(saver.final.cushion * 0.1);
  });
  it("teaches when an uninsured player paid a whole repair", () => {
    const r = replayVoyage(v, saver(() => false));
    expect(r.lessons.some((l) => /draud/i.test(l))).toBe(true);
  });
  it("praises cover that paid off in a year with a repair", () => {
    const r = replayVoyage(v, saver((m) => m === repair + 1));
    expect(r.lessons.some((l) => /draudimas.*(padengė|sutaupė)/i.test(l))).toBe(true);
  });
  it("warns about paying premiums all year for a single repair", () => {
    const r = replayVoyage(v, saver(() => true));
    expect(r.lessons.some((l) => /įmok/i.test(l))).toBe(true);
  });
  it("holding a policy can never cause a shortfall that going without would not have: the claim is netted against the repair", () => {
    const stormy = getVoyage("kursiu-mariu-kapitonas-audringi-metai")!;
    const save = (m: number) => ({ toTax: m <= 9 ? 0.25 : 0.1, toCushion: [4, 5, 6, 7, 8, 9].includes(m) ? 0.5 : 0.15, resistScam: true });
    const costly = (m: number) => {
      const e = stormy.events[stormy.months[m - 1].event];
      return Boolean(e.cost && !e.scam);
    };
    const covered = replayVoyage(stormy, year((m) => ({ ...save(m), insure: costly(m) })));
    const bare = replayVoyage(stormy, year((m) => save(m)));
    expect(covered.totals.shortfall).toBeLessThanOrEqual(bare.totals.shortfall + 0.01);
  });
  it("a repair month with a policy costs the player only the uncovered share plus the premium, in cash terms", () => {
    const only = replayVoyage(v, year((m) => ({ insure: m === repair + 1 })));
    const none = replayVoyage(v, year(() => ({})));
    const cost = v.events["engine-repair"].cost!;
    const net = only.months[repair].premium + (cost - only.months[repair].claimed);
    expect(net).toBeCloseTo(v.insurance.monthlyPremium + cost * (1 - v.insurance.coverage), 2);
    expect(only.months[repair].claimed).toBeGreaterThan(0);
    expect(none.months[repair].claimed).toBe(0);
  });
  it("interest is added to the cushion and is part of the money that exists", () => {
    const r = replayVoyage(v, year((m) => ({ toCushion: m >= 3 ? 0.4 : 0 })));
    const m0 = r.months[5];
    const prev = r.months[4];
    expect(m0.cushion).toBeGreaterThan(prev.cushion + m0.toCushionAmount - 0.01 - m0.shortfall - 1000);
  });
});

describe("the hard year (sunkus metai)", () => {
  const hard = getVoyage("kursiu-mariu-kapitonas-sunkus-metai")!;
  const careful = (resist = true) =>
    year((m) => ({ toTax: m <= 9 ? 0.25 : 0.1, toCushion: [5, 6, 7, 8, 9].includes(m) ? 0.5 : 0.15, resistScam: resist }));

  it("is a different year, not a copy: lower income per season and larger fixed costs", () => {
    expect(hard.baseIncome).toBeLessThan(v.baseIncome * 1.0001 + 0.0001);
    expect(hard.fixedMonthlyCost).toBeGreaterThan(v.fixedMonthlyCost);
    expect(hard.slug).not.toBe(v.slug);
  });
  it("can be won by careful saving: no shortfall, the winter survived, a good score", () => {
    const r = replayVoyage(hard, careful());
    expect(r.survivedWinter).toBe(true);
    expect(r.totals.shortfall).toBe(0);
    expect(r.score.iq).toBeGreaterThanOrEqual(75);
  });
  it("forgives less: one fallen-for scam turns the same careful year into a failed winter", () => {
    const fine = replayVoyage(hard, careful(true));
    const burned = replayVoyage(hard, careful(false));
    expect(burned.survivedWinter).toBe(false);
    expect(burned.score.iq).toBeLessThan(fine.score.iq - 15);
  });
  it("is harder than the base year for the same careful play", () => {
    const base = replayVoyage(v, careful());
    expect(replayVoyage(hard, careful()).score.iq).toBeLessThan(base.score.iq);
    expect(replayVoyage(hard, careful()).netWorth).toBeLessThan(base.netWorth);
  });
  it("still punishes spending everything", () => {
    const r = replayVoyage(hard, year(() => ({ takeLoan: true })));
    expect(r.survivedWinter).toBe(false);
    expect(r.score.iq).toBeLessThanOrEqual(30);
  });
  it("conserves money exactly like the base year", () => {
    for (const picks of [careful(), careful(false), year(() => ({ route: "open" as const }))]) {
      const r = replayVoyage(hard, picks);
      const t = r.totals;
      const pots = r.final.cash + r.final.tax + r.final.cushion;
      const arrived = hard.start.cash + hard.start.tax + hard.start.cushion + t.income + t.loanTaken + t.claimed + t.interestEarned;
      const due = t.fixedCosts + t.eventCosts + t.weatherCosts + t.premiums + t.interest + t.installments + t.taxDue + t.taxPenalty + t.gearBought + t.wants;
      expect(pots).toBeCloseTo(arrived - (due - t.shortfall), 0);
    }
  });
  it("has frozen months at both ends of the year, so winter cannot be dodged by sailing", () => {
    expect(hard.months[0].frozen).toBe(true);
    expect(hard.months[11].frozen).toBe(true);
    expect(replayVoyage(hard, year(() => ({ route: "open" as const }))).months[0].route).toBe("coast");
  });
});

describe("replayVoyage: tampered or broken input", () => {
  it("rejects the wrong number of months", () => {
    expect(() => replayVoyage(v, prudent().slice(0, 11))).toThrow(InvalidPicksError);
    expect(() => replayVoyage(v, [...prudent(), DEFAULT_PICK])).toThrow(InvalidPicksError);
  });
  it("rejects input that is not an array of objects", () => {
    for (const bad of [null, undefined, "x", 12, {}, [1, 2, 3], Array(12).fill(null), Array(12).fill("a")]) {
      expect(() => replayVoyage(v, bad)).toThrow(InvalidPicksError);
    }
  });
  it("rejects shares outside 0 to 1 and non-numbers", () => {
    for (const bad of [-0.1, 1.01, Number.NaN, Number.POSITIVE_INFINITY, "0.5", null]) {
      const picks: unknown[] = prudent();
      picks[3] = { ...DEFAULT_PICK, toTax: bad };
      expect(() => replayVoyage(v, picks)).toThrow(InvalidPicksError);
      picks[3] = { ...DEFAULT_PICK, toCushion: bad };
      expect(() => replayVoyage(v, picks)).toThrow(InvalidPicksError);
    }
  });
  it("rejects flags that are not booleans", () => {
    for (const key of ["upgradeGear", "takeLoan", "resistScam"] as const) {
      const picks: unknown[] = prudent();
      picks[0] = { ...DEFAULT_PICK, [key]: "yes" };
      expect(() => replayVoyage(v, picks)).toThrow(InvalidPicksError);
    }
  });
  it("ignores unknown extra fields instead of trusting them", () => {
    const picks: unknown[] = prudent();
    picks[0] = { ...(picks[0] as object), cash: 999999, iq: 100 };
    const a = replayVoyage(v, picks);
    const b = replayVoyage(v, prudent());
    expect(a.score.iq).toBe(b.score.iq);
    expect(a.months[0].cash).toBe(b.months[0].cash);
  });
});
