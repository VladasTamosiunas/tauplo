import { describe, expect, it } from "vitest";
import { InvalidPicksError } from "../errors";
import { formatEur } from "../format";
import { getVoyage } from "./catalog";
import type { Voyage } from "./schema";
import { DEFAULT_PICK, depositPreview, initialState, playMonth, replayVoyage, type MonthPick } from "./voyage-engine";

/**
 * The term deposit: a share of one month's income is locked for a fixed number of months at a better rate than the
 * cushion, and comes back with interest. These tests set the rate and term themselves so they pin the RULE, not the
 * balance numbers chosen for each year.
 */

const base = getVoyage("kursiu-mariu-kapitonas")!;
/** A voyage where a deposit pays 1.1 % a month for 4 months: a real premium over the cushion's 0.4 %, not a reason to lock everything. */
const v: Voyage = { ...base, deposit: { termMonths: 4, monthlyRate: 0.011 } };

const year = (make: (m: number) => Partial<MonthPick>): MonthPick[] => Array.from({ length: 12 }, (_, i) => ({ ...DEFAULT_PICK, ...make(i + 1) }));
const round2 = (n: number) => Math.round(n * 100) / 100;

describe("placing a deposit", () => {
  it("moves a share of the month's income out of cash and into the locked balance", () => {
    const s0 = initialState(v);
    const plain = playMonth(v, s0, DEFAULT_PICK, 4);
    const locked = playMonth(v, s0, { ...DEFAULT_PICK, deposit: 0.3 }, 4);
    const income = locked.record.income;
    expect(locked.record.depositedAmount).toBeCloseTo(income * 0.3, 2);
    expect(locked.state.locked).toHaveLength(1);
    expect(locked.state.locked[0].amount).toBeCloseTo(income * 0.3, 2);
    // the cash that was not locked is what remains (wants leak from cash, so compare before wants through the totals)
    expect(locked.record.income).toBe(plain.record.income);
    expect(locked.state.cash).toBeLessThan(plain.state.cash);
  });

  it("matures termMonths later, so a deposit placed in month 5 comes due at the end of month 9", () => {
    const r = replayVoyage(v, year((m) => (m === 5 ? { deposit: 0.4 } : {})));
    const placed = r.months[4].depositedAmount;
    expect(placed).toBeGreaterThan(0);
    expect(r.months.slice(5, 8).every((m) => m.maturedAmount === 0)).toBe(true); // months 6, 7, 8
    expect(r.months[8].maturedAmount).toBeCloseTo(placed, 2); // month 9
  });

  it("pays compound interest at the deposit rate for the whole term", () => {
    const r = replayVoyage(v, year((m) => (m === 3 ? { deposit: 0.5 } : {})));
    const placed = r.months[2].depositedAmount;
    const expected = round2(placed * (1.011 ** 4 - 1));
    expect(r.months[6].depositInterest).toBeCloseTo(expected, 1);
    expect(r.totals.depositInterest).toBeCloseTo(expected, 1);
  });

  it("pays a better rate than the cushion does over the same months", () => {
    expect(v.deposit!.monthlyRate).toBeGreaterThan(v.savingsRate);
  });

  it("a deposit placed too late to mature still counts in the final net worth", () => {
    // a comfortable player (cushion funded through the summer), so no bill goes unpaid and nothing is charged against the deposit
    const r = replayVoyage(v, year((m) => ({ toTax: 0.25, toCushion: [4, 5, 6, 7, 8, 9].includes(m) ? 0.4 : 0.15, resistScam: true, ...(m === 11 ? { deposit: 0.5 } : {}) })));
    const placed = r.months[10].depositedAmount;
    expect(placed).toBeGreaterThan(0);
    expect(r.totals.maturedAmount).toBe(0);
    expect(r.final.locked).toHaveLength(1);
    expect(r.totals.shortfall).toBe(0);
    // locked money is wealth: net worth is cash + tax + cushion + locked - debt
    expect(r.netWorth).toBeCloseTo(r.final.cash + r.final.tax + r.final.cushion + placed - r.final.debt, 2);
  });
});

describe("a deposit can never cause a shortfall by itself", () => {
  /** Same principle as buying gear: the bank will not lock money the player needs for this month's bill. */
  it("refuses to lock money when cash plus cushion would fall below one month of fixed costs", () => {
    // May of the stormy-style squeeze: cash and cushion are nearly empty, so locking must be limited
    let st = initialState(v);
    for (let i = 0; i < 4; i++) st = playMonth(v, st, { ...DEFAULT_PICK, toTax: 0.25, toCushion: 0.4 }, i).state;
    const liquid = (s: typeof st) => s.cash + s.cushion;
    const month = 4;
    const r = playMonth(v, st, { ...DEFAULT_PICK, deposit: 1 }, month);
    // whatever it locked, what the player still holds after the split must cover the fixed bill
    const afterSplit = liquid(st) + r.record.income - r.record.depositedAmount - r.record.toTaxAmount - r.record.toCushionAmount;
    expect(afterSplit).toBeGreaterThanOrEqual(Math.min(liquid(st) + r.record.income, v.fixedMonthlyCost) - 0.01);
  });

  it("locks less than asked when asked for everything, and tells the record how much it really locked", () => {
    const rich = playMonth(v, { ...initialState(v), cash: 3000 }, { ...DEFAULT_PICK, deposit: 1 }, 6);
    const poor = playMonth(v, { ...initialState(v), cash: 0 }, { ...DEFAULT_PICK, deposit: 1 }, 6);
    // a rich player can lock the whole month's income; a player with nothing in reserve cannot
    expect(rich.record.depositedAmount).toBeGreaterThan(poor.record.depositedAmount);
    expect(poor.record.depositedAmount).toBeLessThanOrEqual(poor.record.income);
  });

  it("a careful player who deposits spare summer money never ends a month short because of it", () => {
    for (const m0 of [4, 5, 6, 7]) {
      const withDep = replayVoyage(v, year((m) => ({ toTax: 0.25, toCushion: [4, 5, 6, 7, 8, 9].includes(m) ? 0.4 : 0.15, resistScam: true, ...(m === m0 ? { deposit: 0.5 } : {}) })));
      const without = replayVoyage(v, year((m) => ({ toTax: 0.25, toCushion: [4, 5, 6, 7, 8, 9].includes(m) ? 0.4 : 0.15, resistScam: true })));
      expect(withDep.totals.shortfall, `deposit in month ${m0}`).toBeLessThanOrEqual(without.totals.shortfall);
    }
  });

  it("the surprise month: with the cushion empty a request to lock everything is cut down to what leaves a month of bills", () => {
    const squeezed = playMonth(v, { ...initialState(v), cash: 0, cushion: 0 }, { ...DEFAULT_PICK, deposit: 1 }, 4); // May
    const kept = squeezed.record.income - squeezed.record.depositedAmount;
    expect(kept).toBeGreaterThanOrEqual(Math.min(squeezed.record.income, v.fixedMonthlyCost) - 0.01);
  });
});

describe("lessons about deposits", () => {
  const mentions = (r: ReturnType<typeof replayVoyage>) => r.lessons.filter((l) => /indėl/i.test(l));
  const comfortable = (m: number): Partial<MonthPick> => ({ toTax: 0.25, toCushion: [4, 5, 6, 7, 8, 9].includes(m) ? 0.3 : 0.15, resistScam: true });

  it("says nothing about deposits to a player who never used one", () => {
    expect(mentions(replayVoyage(v, year(comfortable)))).toEqual([]);
  });
  it("praises a deposit that came back and was saved again, and states the interest it earned", () => {
    const r = replayVoyage(v, year((m) => ({ ...comfortable(m), ...(m === 5 || m === 6 ? { deposit: 0.2 } : {}), ...(m === 9 || m === 10 ? { toCushion: 0.7 } : {}) })));
    const l = mentions(r);
    expect(l).toHaveLength(1);
    expect(l[0]).toContain(formatEur(r.totals.depositInterest));
    expect(l[0]).toMatch(/vėl|iš naujo|atidėjai/i);
  });
  it("warns a player who let the returned money sit in cash and leak into spending", () => {
    const r = replayVoyage(v, year((m) => ({ ...comfortable(m), toCushion: 0, ...(m === 5 || m === 6 ? { deposit: 0.3 } : {}) })));
    expect(r.totals.maturedAmount).toBeGreaterThan(0);
    expect(r.totals.wants).toBeGreaterThan(0);
    const l = mentions(r);
    expect(l.length).toBeGreaterThanOrEqual(1);
    expect(l.join(" ")).toMatch(/nutekėj|išleid|norams/i);
  });
  it("tells a player the bank cut a deposit because they needed that money for bills", () => {
    const squeezed = replayVoyage(v, year((m) => (m === 5 ? { deposit: 1 } : {})));
    expect(squeezed.months[4].depositedAmount).toBeLessThan(squeezed.months[4].income);
    expect(mentions(squeezed).join(" ")).toMatch(/sąskait|rezerv|palik/i);
  });
  it("explains that locked money could not pay a bill, when bills went unpaid while money was locked", () => {
    const r = replayVoyage(v, year((m) => (m >= 4 ? { deposit: 0.6, toTax: 0.25, resistScam: true } : { toTax: 0.25, resistScam: true })));
    expect(r.totals.unpaidWhileLocked).toBeGreaterThan(0);
    expect(mentions(r).join(" ")).toMatch(/negalėjai|užrakint/i);
  });
  it("uses no em-dash or en-dash and names no more than three deposit lessons", () => {
    for (const picks of [year((m) => (m === 5 ? { deposit: 1 } : {})), year((m) => (m >= 4 ? { deposit: 0.6 } : {}))]) {
      const l = mentions(replayVoyage(v, picks));
      expect(l.length).toBeLessThanOrEqual(3);
      for (const s of l) expect(s).not.toMatch(/[–—]/);
    }
  });
});

describe("depositPreview: what the player is told before choosing", () => {
  it("agrees with what the engine really locks, for every share, at every point of a year", () => {
    let st = initialState(v);
    const pick = { ...DEFAULT_PICK, toTax: 0.25, toCushion: 0.3, resistScam: true };
    for (let i = 0; i < 12; i++) {
      for (const share of [0, 0.1, 0.3, 0.5, 1]) {
        const shown = depositPreview(v, st, { ...pick, deposit: share }, i);
        const real = playMonth(v, st, { ...pick, deposit: share }, i).record;
        expect(shown.locked, `month ${i + 1}, share ${share}`).toBeCloseTo(real.depositedAmount, 2);
        expect(shown.windfall).toBeCloseTo(real.maturedAmount + real.depositInterest, 2);
      }
      st = playMonth(v, st, { ...pick, deposit: i === 4 ? 0.2 : 0 }, i).state;
    }
  });
  it("sets aside exactly what the booked month moves out of cash, even when the shares add up to more than 100 %", () => {
    const mixes = [
      { toTax: 0.25, toCushion: 0.3, deposit: 0.2 },
      { toTax: 0.5, toCushion: 0.5, deposit: 0.5 }, // 150 %: scaled down
      { toTax: 0, toCushion: 0, deposit: 1 },
      { toTax: 0.1, toCushion: 0.1, deposit: 0 },
    ];
    let st = initialState(v);
    for (let i = 0; i < 12; i++) {
      for (const mix of mixes) {
        const pick = { ...DEFAULT_PICK, ...mix };
        const shown = depositPreview(v, st, pick, i);
        const r = playMonth(v, st, pick, i).record;
        expect(shown.setAside, `month ${i + 1} ${JSON.stringify(mix)}`).toBeCloseTo(r.toTaxAmount + r.toCushionAmount + r.depositedAmount, 2);
        expect(shown.available).toBeCloseTo(r.income + r.maturedAmount + r.depositInterest, 2);
      }
      st = playMonth(v, st, { ...DEFAULT_PICK, toTax: 0.25, toCushion: 0.3, deposit: i === 4 ? 0.2 : 0 }, i).state;
    }
  });
  it("reports when the bank cut the request, and by how much", () => {
    const squeezed = depositPreview(v, { ...initialState(v), cash: 0, cushion: 0 }, { ...DEFAULT_PICK, deposit: 1 }, 4);
    expect(squeezed.cut).toBe(true);
    expect(squeezed.asked).toBeGreaterThan(squeezed.locked);
    const rich = depositPreview(v, { ...initialState(v), cash: 5000 }, { ...DEFAULT_PICK, deposit: 0.2 }, 6);
    expect(rich.cut).toBe(false);
    expect(rich.locked).toBeCloseTo(rich.asked, 2);
  });
  it("says what the money turns into and when it returns", () => {
    const p = depositPreview(v, { ...initialState(v), cash: 5000 }, { ...DEFAULT_PICK, deposit: 0.5 }, 4);
    expect(p.returnsInMonth).toBe(5 + 4);
    expect(p.interest).toBeCloseTo(p.locked * (1.011 ** 4 - 1), 1);
  });
  it("is empty when the voyage offers no deposit", () => {
    const { deposit: _x, ...rest } = base;
    void _x;
    const none = depositPreview(rest as Voyage, initialState(base), { ...DEFAULT_PICK, deposit: 0.5 }, 4);
    expect(none.locked).toBe(0);
    expect(none.offered).toBe(false);
  });
});

describe("a deposit cannot be used to skip bills and still come out ahead", () => {
  /** Locking money never becomes a way to leave bills unpaid and keep the interest: unpaid bills are still owed. */
  const greedy = (m: number): Partial<MonthPick> => (m >= 4 ? { deposit: 0.6, toTax: 0.25, resistScam: true } : { toTax: 0.25, resistScam: true });

  it("a player who locks so much that bills go unpaid does not beat a player who pays them", () => {
    // the careful player insures the repair month, as the balance tests do, so both sides are playing sensibly
    const repair = (m: number) => v.events[v.months[m - 1].event].cost !== undefined && !v.events[v.months[m - 1].event].scam;
    const careful = replayVoyage(v, year((m) => ({ toTax: m <= 9 ? 0.25 : 0.1, toCushion: [4, 5, 6, 7, 8, 9].includes(m) ? 0.4 : 0.15, resistScam: true, insure: repair(m) })));
    const skipper = replayVoyage(v, year(greedy));
    expect(skipper.totals.shortfall).toBeGreaterThan(0); // the premise: this strategy leaves bills unpaid
    expect(skipper.survivedWinter).toBe(false);
    expect(skipper.netWorth).toBeLessThan(careful.netWorth);
  });

  it("unpaid bills reduce net worth by the amount left unpaid while money was locked", () => {
    const r = replayVoyage(v, year(greedy));
    const owed = r.totals.shortfall;
    const lockedAtEnd = r.final.locked.reduce((n, d) => n + d.amount, 0);
    expect(r.netWorth).toBeCloseTo(r.final.cash + r.final.tax + r.final.cushion + lockedAtEnd - r.final.debt - r.totals.unpaidWhileLocked, 2);
    expect(r.totals.unpaidWhileLocked).toBeGreaterThan(0);
    expect(r.totals.unpaidWhileLocked).toBeLessThanOrEqual(owed);
  });

  it("is zero for every run that never locks money, so old results do not change", () => {
    const none = replayVoyage(v, year(() => ({ takeLoan: true })));
    expect(none.totals.shortfall).toBeGreaterThan(0);
    expect(none.totals.unpaidWhileLocked).toBe(0);
  });
});

describe("a matured deposit is a windfall the player decides about", () => {
  /** A year where May is deposited so that it comes due in month 9 (4-month term). */
  const placeMay = (rest: (m: number) => Partial<MonthPick>) => year((m) => (m === 5 ? { deposit: 0.5 } : rest(m)));

  it("pays out at the START of its month, so that month's split can use it", () => {
    const r = replayVoyage(v, placeMay((m) => (m === 9 ? { toCushion: 1 } : {})));
    const sept = r.months[8];
    expect(sept.maturedAmount).toBeGreaterThan(0);
    // 100 % to the cushion: the cushion gains the month's income AND the matured principal and interest
    expect(sept.toCushionAmount).toBeCloseTo(sept.income + sept.maturedAmount + sept.depositInterest, 1);
  });

  it("is not eaten by impulse spending when the player saves it: wants stay the same as a run with no deposit", () => {
    const saved = replayVoyage(v, placeMay((m) => ({ toCushion: m === 9 ? 1 : 0.2, toTax: 0.2 })));
    const never = replayVoyage(v, year((m) => ({ toCushion: m === 9 ? 1 : 0.2, toTax: 0.2 })));
    // saving the windfall in the cushion costs at most the deposit's own month-5 cash, never a lump of wants
    expect(saved.totals.wants).toBeLessThanOrEqual(never.totals.wants + 1);
  });

  it("left unsaved it leaks like any pocket money: the player who ignores a windfall loses part of it to wants", () => {
    const ignored = replayVoyage(v, placeMay(() => ({})));
    const saved = replayVoyage(v, placeMay((m) => (m === 9 ? { toCushion: 1 } : {})));
    expect(ignored.totals.wants).toBeGreaterThan(saved.totals.wants);
  });

  it("the deposit's pay-out is counted once: income is unchanged, the windfall is reported separately", () => {
    const r = replayVoyage(v, placeMay(() => ({})));
    const plain = replayVoyage(v, year(() => ({})));
    expect(r.months[8].income).toBe(plain.months[8].income);
    expect(r.totals.income).toBe(plain.totals.income);
  });
});

describe("locked money is really locked", () => {
  it("cannot pay a bill: in the months before it matures the bills are paid from cash and the cushion only", () => {
    // lock all of July, then watch the lean months: the locked amount stays whole while bills draw cash down
    let st = initialState(v);
    for (let i = 0; i < 6; i++) st = playMonth(v, st, DEFAULT_PICK, i).state;
    st = playMonth(v, st, { ...DEFAULT_PICK, deposit: 1 }, 6).state; // July
    const principal = st.locked[0].amount;
    expect(st.locked[0].matures).toBe(7 + 4);
    for (let i = 7; i < 10; i++) {
      st = playMonth(v, st, DEFAULT_PICK, i).state; // Aug, Sep, Oct: bills every month, nothing earned to spare
      expect(st.locked.reduce((n, d) => n + d.amount, 0)).toBeCloseTo(principal, 2);
    }
  });

  it("is safe from impulse spending: money that is locked does not leak into wants", () => {
    // with 50 % of spare cash leaking each month, a locked euro is the one euro the player cannot waste
    const locked = replayVoyage(v, year((m) => (m === 7 ? { deposit: 1 } : {})));
    const free = replayVoyage(v, year(() => ({})));
    expect(locked.totals.wants).toBeLessThan(free.totals.wants);
  });

  it("is not the cushion: the same money in the cushion would pay bills, in a deposit it cannot", () => {
    // an emergency in the lean months: with the money locked there is less to pay it with than with the same money in the cushion
    const lockIt = replayVoyage(v, year((m) => (m === 7 ? { deposit: 0.8 } : {})));
    const cushionIt = replayVoyage(v, year((m) => (m === 7 ? { toCushion: 0.8 } : {})));
    // August to October the cushion can cover bills; the deposit cannot. So the deposit run is no better in those months.
    const lean = (r: typeof lockIt) => r.months.slice(7, 10).reduce((n, m) => n + m.shortfall, 0);
    expect(lean(lockIt)).toBeGreaterThanOrEqual(lean(cushionIt));
  });

  it("is not part of the cushion, so it does not count toward the cushion score", () => {
    const withDeposit = replayVoyage(v, year((m) => (m === 5 ? { deposit: 0.5 } : {})));
    expect(withDeposit.final.cushion).toBe(0);
    expect(withDeposit.cushionMonths).toBe(0);
  });

  it("is not spent by pay(): a month with bills larger than cash leaves the locked amount untouched", () => {
    let s = initialState(v);
    s = playMonth(v, s, { ...DEFAULT_PICK, deposit: 1 }, 5).state; // lock all of May's income
    const lockedBefore = s.locked.reduce((n, d) => n + d.amount, 0);
    expect(lockedBefore).toBeGreaterThan(0);
    // run lean months with no income to speak of; bills hit cash and the cushion only
    for (let i = 5; i < 8; i++) s = playMonth(v, s, DEFAULT_PICK, i).state;
    const stillLocked = s.locked.reduce((n, d) => n + d.amount, 0);
    expect(stillLocked).toBeCloseTo(lockedBefore, 2);
  });

  it("is not taxed away early: the tax jar is separate and untouched by a deposit", () => {
    const a = replayVoyage(v, year((m) => ({ toTax: 0.25, ...(m === 6 ? { deposit: 0.3 } : {}) })));
    const b = replayVoyage(v, year(() => ({ toTax: 0.25 })));
    expect(a.months[5].tax).toBe(b.months[5].tax);
  });
});

describe("money is conserved with deposits", () => {
  it("every euro locked comes back, with its interest, or is still locked at the end", () => {
    for (const picks of [
      year((m) => (m === 3 ? { deposit: 0.5 } : {})),
      year((m) => (m === 6 || m === 7 ? { deposit: 0.4, toTax: 0.2 } : { toCushion: 0.1 })),
      year((m) => ({ deposit: m <= 8 ? 0.2 : 0, takeLoan: m === 2 })),
    ]) {
      const r = replayVoyage(v, picks);
      const t = r.totals;
      const lockedAtEnd = r.final.locked.reduce((n, d) => n + d.amount, 0);
      const pots = r.final.cash + r.final.tax + r.final.cushion + lockedAtEnd;
      const arrived = v.start.cash + v.start.tax + v.start.cushion + t.income + t.loanTaken + t.claimed + t.interestEarned + t.depositInterest;
      const due = t.fixedCosts + t.eventCosts + t.weatherCosts + t.premiums + t.interest + t.installments + t.taxDue + t.taxPenalty + t.gearBought + t.wants;
      expect(pots).toBeCloseTo(arrived - (due - t.shortfall), 0);
    }
  });
});

describe("old picks and tampered picks", () => {
  it("a pick with no deposit field means no deposit", () => {
    // picks as an older client saved them: the deposit field is simply absent
    const old = year(() => ({ toTax: 0.2 })).map((p) => {
      const copy: Partial<MonthPick> = { ...p };
      delete copy.deposit;
      return copy;
    });
    const r = replayVoyage(v, old);
    expect(r.totals.depositedAmount).toBe(0);
    expect(r.final.locked).toEqual([]);
  });
  it("rejects a deposit above 100 %, below 0 and one that is not a number", () => {
    for (const bad of [1.5, -0.2, "0.3", null, Number.NaN]) {
      const picks = year(() => ({})).map((p, i) => (i === 4 ? { ...p, deposit: bad } : p));
      expect(() => replayVoyage(v, picks)).toThrow(InvalidPicksError);
    }
  });
  it("a deposit and the tax and cushion splits together can never exceed the income", () => {
    const r = replayVoyage(v, year((m) => (m === 6 ? { toTax: 0.5, toCushion: 0.5, deposit: 0.5 } : {})));
    const m = r.months[5];
    expect(m.toTaxAmount + m.toCushionAmount + m.depositedAmount).toBeLessThanOrEqual(m.income + 0.02);
  });
  it("in a voyage with no deposit offered, a deposit pick is ignored and nothing is locked", () => {
    // build the voyage explicitly without the field, so this keeps testing "not offered" whatever the shipped years do
    const { deposit: _offered, ...rest } = base;
    void _offered;
    const without: Voyage = rest;
    expect(without.deposit).toBeUndefined();
    const r = replayVoyage(without, year((m) => (m === 5 ? { deposit: 0.5 } : {})));
    expect(r.totals.depositedAmount).toBe(0);
    expect(r.final.locked).toEqual([]);
  });
});
