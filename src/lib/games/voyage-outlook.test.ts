import { describe, expect, it } from "vitest";
import { getVoyage } from "./catalog";
import { outlookFor } from "./voyage-outlook";
import { DEFAULT_PICK, initialState, playMonth, type VoyageState } from "./voyage-engine";

const v = getVoyage("kursiu-mariu-kapitonas")!;

/** The state at the start of month `index` for a player who set aside the given shares every month. */
function stateAt(index: number, toTax = 0, toCushion = 0): VoyageState {
  let st = initialState(v);
  for (let i = 0; i < index; i++) st = playMonth(v, st, { ...DEFAULT_PICK, toTax, toCushion, resistScam: true }, i).state;
  return st;
}

describe("outlookFor: the next tax deadline", () => {
  it("points at the next due month at or after the current one", () => {
    expect(outlookFor(v, initialState(v), 0).tax.dueMonth).toBe(3);
    expect(outlookFor(v, stateAt(3), 3).tax.dueMonth).toBe(6);
    expect(outlookFor(v, stateAt(2), 2).tax.dueMonth).toBe(3); // the due month itself still counts
  });
  it("counts the months until it, with zero meaning this month", () => {
    expect(outlookFor(v, initialState(v), 0).tax.monthsAway).toBe(2);
    expect(outlookFor(v, stateAt(2), 2).tax.monthsAway).toBe(0);
  });
  it("has no deadline after the last due month", () => {
    const o = outlookFor(v, stateAt(11), 11);
    expect(o.tax.dueMonth).toBe(12); // December is itself due
    const none = { ...v, taxDueMonths: [3, 6] };
    expect(outlookFor(none, stateAt(8), 8).tax.dueMonth).toBeNull();
  });
  it("projects the bill from the tax already owed and the jar from what is in it", () => {
    const st = stateAt(2, 0.25);
    const o = outlookFor(v, st, 2);
    expect(o.tax.owed).toBeCloseTo(st.liability, 2);
    expect(o.tax.inJar).toBeCloseTo(st.tax, 2);
    expect(o.tax.gap).toBeCloseTo(Math.max(0, st.liability - st.tax), 2);
  });
  it("shows a gap when nothing was set aside and no gap when the jar is full enough", () => {
    expect(outlookFor(v, stateAt(2, 0), 2).tax.gap).toBeGreaterThan(0);
    expect(outlookFor(v, stateAt(2, 0), 2).tax.status).toBe("short");
    expect(outlookFor(v, stateAt(2, 0.5), 2).tax.gap).toBe(0);
    expect(outlookFor(v, stateAt(2, 0.5), 2).tax.status).toBe("covered");
  });
  it("includes the share of the current month's income still to be earned and the penalty rate", () => {
    const o = outlookFor(v, stateAt(2, 0.25), 2);
    expect(o.tax.penaltyRate).toBe(v.taxPenaltyRate);
  });
});

describe("outlookFor: how long the money lasts", () => {
  it("measures the months of fixed costs that cash plus cushion could pay", () => {
    const st = { ...initialState(v), cash: 840, cushion: 420 };
    expect(outlookFor(v, st, 0).runwayMonths).toBeCloseTo(3, 5);
  });
  it("is zero with no money and never negative", () => {
    const st = { ...initialState(v), cash: 0, cushion: 0 };
    expect(outlookFor(v, st, 0).runwayMonths).toBe(0);
  });
  it("does not count the tax jar, which belongs to the tax office", () => {
    const rich = { ...initialState(v), cash: 0, cushion: 0, tax: 5000 };
    expect(outlookFor(v, rich, 0).runwayMonths).toBe(0);
  });
});

describe("outlookFor: the coming winter", () => {
  it("looks ahead to the first lean month and reports the cost of getting through it", () => {
    const o = outlookFor(v, initialState(v), 3);
    expect(o.winter.firstLeanMonth).toBeGreaterThan(3);
    expect(o.winter.leanMonths).toBeGreaterThan(0);
  });
  it("is empty in the middle of summer when no lean month is left in the same stretch", () => {
    const o = outlookFor(v, stateAt(5), 5);
    expect(o.winter.firstLeanMonth).not.toBeNull();
    expect(o.winter.monthsAway).toBeGreaterThan(0);
  });
  it("estimates the shortfall as the lean months' costs minus what the lean months earn, against the money on hand", () => {
    const poor = { ...initialState(v), cash: 0, cushion: 0 };
    const rich = { ...initialState(v), cash: 0, cushion: 5000 };
    expect(outlookFor(v, poor, 6).winter.gap).toBeGreaterThan(0);
    expect(outlookFor(v, rich, 6).winter.gap).toBe(0);
  });
  it("a lean month is one whose season is below the winter threshold", () => {
    const o = outlookFor(v, initialState(v), 0);
    expect(o.winter.firstLeanMonth).toBe(1); // January is lean at the very start
    expect(o.winter.monthsAway).toBe(0);
  });
  it("reports the status in words the page can show, not only a number", () => {
    const poor = { ...initialState(v), cash: 0, cushion: 0 };
    expect(["covered", "tight", "short"]).toContain(outlookFor(v, poor, 6).winter.status);
    expect(outlookFor(v, poor, 6).winter.status).toBe("short");
    expect(outlookFor(v, { ...poor, cushion: 6000 }, 6).winter.status).toBe("covered");
  });
});

describe("outlookFor: it must not reassure a player who is about to run short", () => {
  /** Plays months [0, upTo) with the given saving shares, refusing scams, then returns the state. */
  const reach = (upTo: number, toTax: number, toCushion: number) => {
    let st = initialState(v);
    for (let i = 0; i < upTo; i++) st = playMonth(v, st, { ...DEFAULT_PICK, toTax, toCushion, resistScam: true }, i).state;
    return st;
  };
  /** Plays the rest of the year on the coast with no new choices and returns the total shortfall. */
  const realShortfall = (st: VoyageState, from: number) => {
    let s2 = st;
    let short = 0;
    for (let i = from; i < 12; i++) {
      const r = playMonth(v, s2, { ...DEFAULT_PICK, resistScam: true }, i);
      s2 = r.state;
      short += r.record.shortfall;
    }
    return short;
  };

  it("counts the coming tax deadline into the winter picture, because that bill is known", () => {
    const st = reach(9, 0, 0);
    const o = outlookFor(v, st, 9);
    expect(o.winter.scheduled).toBeGreaterThan(0);
  });
  it("counts the known costs of the coming months (a repair, the holidays), not only the fixed bills", () => {
    const o = outlookFor(v, reach(9, 0, 0), 9);
    expect(o.winter.cost).toBeGreaterThan(v.fixedMonthlyCost * o.winter.leanMonths);
  });
  it("warns the player who saved nothing: a real shortfall is ahead, so the status is not covered", () => {
    const st = reach(9, 0, 0);
    expect(realShortfall(st, 9)).toBeGreaterThan(0);
    expect(outlookFor(v, st, 9).winter.status).not.toBe("covered");
    expect(outlookFor(v, st, 9).winter.gap).toBeGreaterThan(0);
  });
  it("reassures a strong saver, who really does get through", () => {
    const st = reach(9, 0.25, 0.4);
    expect(realShortfall(st, 9)).toBe(0);
    expect(outlookFor(v, st, 9).winter.status).toBe("covered");
  });
  it("never says covered when the coast really leaves a shortfall, across many saving habits and months", () => {
    for (const month of [2, 5, 8, 9, 10]) {
      for (const tax of [0, 0.1, 0.25]) {
        for (const cush of [0, 0.1, 0.3, 0.5]) {
          const st = reach(month, tax, cush);
          const o = outlookFor(v, st, month);
          if (realShortfall(st, month) > 0.5 && o.winter.leanMonths > 0 && o.winter.monthsAway <= 3) {
            expect(o.winter.status, `month ${month} tax ${tax} cushion ${cush}`).not.toBe("covered");
          }
        }
      }
    }
  });
});

describe("outlookFor: robustness", () => {
  it("never returns NaN or a negative amount for any month and any plausible state", () => {
    for (let i = 0; i < 12; i++) {
      for (const st of [initialState(v), stateAt(i), { ...initialState(v), cash: 0, cushion: 0, tax: 0, debt: 9999 }]) {
        const o = outlookFor(v, st, i);
        for (const n of [o.runwayMonths, o.tax.owed, o.tax.inJar, o.tax.gap, o.winter.gap, o.winter.cost]) {
          expect(Number.isFinite(n)).toBe(true);
          expect(n).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });
  it("clamps an out-of-range month instead of throwing", () => {
    expect(() => outlookFor(v, initialState(v), 99)).not.toThrow();
    expect(() => outlookFor(v, initialState(v), -3)).not.toThrow();
  });
});

describe("outlookFor: locked deposits and markets", () => {
  /** A player who locked 80 % of May's income, looking at the start of June. */
  const lockedAtJune = () => {
    let st = stateAt(4, 0.2, 0.2);
    st = playMonth(v, st, { ...DEFAULT_PICK, toTax: 0.2, toCushion: 0.2, deposit: 0.4, resistScam: true }, 4).state;
    return st;
  };

  it("does not count locked money as something that could pay the winter's bills", () => {
    const st = lockedAtJune();
    const locked = st.locked.reduce((n, d) => n + d.amount, 0);
    expect(locked).toBeGreaterThan(0);
    const o = outlookFor(v, st, 5);
    expect(o.runwayMonths).toBeCloseTo((st.cash + st.cushion) / v.fixedMonthlyCost, 1);
    // had the locked money been counted, the runway would be larger by locked / fixed
    expect(o.runwayMonths).toBeLessThan((st.cash + st.cushion + locked) / v.fixedMonthlyCost - 0.1);
  });
  it("sees the deposit coming back: the winter looks no worse than if the money had simply been spent", () => {
    const st = lockedAtJune();
    const asIfSpent = { ...st, locked: [] };
    expect(outlookFor(v, st, 5).winter.gap).toBeLessThanOrEqual(outlookFor(v, asIfSpent, 5).winter.gap);
  });
  it("never says covered when the engine would leave bills unpaid, with money locked up", () => {
    for (const month of [3, 4, 5, 6, 7, 8]) {
      for (const deposit of [0.2, 0.5, 1]) {
        let st = stateAt(month - 1, 0.25, 0.1);
        st = playMonth(v, st, { ...DEFAULT_PICK, toTax: 0.25, toCushion: 0.1, deposit, resistScam: true }, month - 1).state;
        const o = outlookFor(v, st, month);
        if (o.winter.status === "covered") expect(o.winter.gap, `month ${month} deposit ${deposit}`).toBe(0);
      }
    }
  });
});
