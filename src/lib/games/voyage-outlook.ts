import type { Voyage } from "./schema";
import { DEFAULT_PICK, WINTER_SEASON, playMonth, type VoyageState } from "./voyage-engine";

/**
 * What lies ahead. The forecast does not re-implement any rule: it plays the remaining months with the
 * engine itself, on the coast, with no new choices, refusing scams. So wants, tax, penalties, interest and
 * announced events all behave exactly as they will in the game, and the forecast cannot drift from the rules.
 *
 * It is advice, not a promise. It leaves out what nobody can know: the weather on open water and
 * events flagged as surprises (those are not even shown on the planning screen).
 */

export type OutlookStatus = "covered" | "tight" | "short";

export type Outlook = {
  /** Months of fixed costs that cash plus the cushion could pay. The tax jar is not counted: it belongs to the tax office. */
  runwayMonths: number;
  tax: {
    /** 1-based month of the next deadline, or null when none is left. */
    dueMonth: number | null;
    /** 0 means this very month. */
    monthsAway: number;
    /** Tax owed so far this period. */
    owed: number;
    inJar: number;
    /** The part of the bill the jar does not cover. */
    gap: number;
    penaltyRate: number;
    status: OutlookStatus;
  };
  winter: {
    /** 1-based number of the first lean month from now on, or null when the year has no more lean months. */
    firstLeanMonth: number | null;
    monthsAway: number;
    /** How many lean months in the next stretch. */
    leanMonths: number;
    /** Fixed bills plus announced events plus tax falling due, from this month to the end of the stretch. */
    cost: number;
    /** The part of that which is not a fixed bill: tax falling due and announced events. */
    scheduled: number;
    /** What the same months earn on the coast. */
    expectedIncome: number;
    /** Bills the player could not pay if they changed nothing from now on (the engine's own shortfall). */
    gap: number;
    status: OutlookStatus;
  };
};

const round2 = (n: number) => Math.round(n * 100) / 100;
const nonNegative = (n: number) => (Number.isFinite(n) && n > 0 ? round2(n) : 0);

/** A surprise is never shown while planning, so the forecast must not know about it either. */
function withoutSurprises(v: Voyage): Voyage {
  const events = Object.fromEntries(Object.entries(v.events).map(([k, e]) => [k, e.surprise ? { ...e, cost: undefined } : e]));
  return { ...v, events };
}

export function outlookFor(v: Voyage, state: VoyageState, monthIndex: number): Outlook {
  const last = v.months.length - 1;
  const index = Math.max(0, Math.min(last, Math.trunc(Number.isFinite(monthIndex) ? monthIndex : 0)));
  const onHand = nonNegative(state.cash) + nonNegative(state.cushion);

  // tax: the next due month at or after this one
  const dueIndex = v.months.findIndex((_, i) => i >= index && v.taxDueMonths.includes(i + 1));
  const owed = nonNegative(state.liability);
  const inJar = nonNegative(state.tax);
  const taxGap = nonNegative(owed - inJar);
  const taxStatus: OutlookStatus = taxGap === 0 ? "covered" : inJar >= owed * 0.6 ? "tight" : "short";

  // winter: the first lean month from now on, and the unbroken run of lean months after it
  const lean = (i: number) => v.months[i].season < WINTER_SEASON;
  const first = v.months.findIndex((_, i) => i >= index && lean(i));
  let leanMonths = 0;
  let end = -1;
  if (first !== -1) {
    end = first;
    while (end + 1 <= last && lean(end + 1)) end++;
    leanMonths = end - first + 1;
  }

  // play the months from now to the end of that run with the engine's own rules and no new decisions
  const known = withoutSurprises(v);
  let st: VoyageState = { ...state };
  let cost = 0;
  let scheduled = 0;
  let expectedIncome = 0;
  let shortfall = 0;
  if (first !== -1) {
    for (let i = index; i <= end; i++) {
      const r = playMonth(known, st, { ...DEFAULT_PICK, resistScam: true }, i);
      st = r.state;
      expectedIncome += r.record.income;
      const month = r.record.fixedCost + r.record.eventCost + r.record.taxDue + r.record.taxPenalty;
      cost += month;
      scheduled += r.record.eventCost + r.record.taxDue;
      shortfall += r.record.shortfall;
    }
  }
  const winterGap = nonNegative(shortfall);
  // "tight" means nothing is unpaid, but the money left at the end is less than one month of bills
  const leftAtEnd = nonNegative(st.cash) + nonNegative(st.cushion);
  const winterStatus: OutlookStatus = winterGap > 0 ? "short" : first !== -1 && leftAtEnd < v.fixedMonthlyCost ? "tight" : "covered";

  return {
    runwayMonths: v.fixedMonthlyCost > 0 ? round2(onHand / v.fixedMonthlyCost) : 0,
    tax: {
      dueMonth: dueIndex === -1 ? null : dueIndex + 1,
      monthsAway: dueIndex === -1 ? 0 : dueIndex - index,
      owed,
      inJar,
      gap: taxGap,
      penaltyRate: v.taxPenaltyRate,
      status: taxStatus,
    },
    winter: {
      firstLeanMonth: first === -1 ? null : first + 1,
      monthsAway: first === -1 ? 0 : first - index,
      leanMonths,
      cost: nonNegative(cost),
      scheduled: nonNegative(scheduled),
      expectedIncome: nonNegative(expectedIncome),
      gap: winterGap,
      status: winterStatus,
    },
  };
}
