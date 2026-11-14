import { z } from "zod";
import { InvalidPicksError } from "../errors";
import { formatEur, formatNumber, pluralLt } from "../format";
import type { Voyage, Weather } from "./schema";

/**
 * Kuršių marių kapitonas: one year, twelve months, one decision round per month.
 *
 * Money lives in four places: cash in the pocket, a tax jar, a cushion jar, and debt.
 * Each month the player also picks a route: the coast (steady) or open water (more when the weather
 * is calm, much less in a storm, and a repair bill). The forecast they see is sometimes wrong.
 * In order: income arrives and the player splits a share of it into the jars;
 * the loan is serviced; a new loan may be taken; a gear upgrade may be bought; bills, the month's
 * event and (in due months) tax are paid; finally part of the pocket money above a small float
 * leaks away into wants. A bill that cannot be paid from cash and then from the cushion is
 * recorded as a shortfall instead of vanishing.
 *
 * Pure functions, no I/O. The browser steps month by month with `playMonth`; the server replays
 * the whole year from the raw picks with `replayVoyage` and trusts nothing else.
 */

export type Route = "coast" | "open";

export type MonthPick = {
  /** Hold the insurance policy this month. Pays toward repair and storm costs, never a scam. */
  insure: boolean;
  /** Where to sail this month. Open water is only possible when the lagoon is not frozen. */
  route: Route;
  /** Share of this month's income put into the tax jar, 0 to 1. */
  toTax: number;
  /** Share of this month's income put into the cushion jar, 0 to 1. */
  toCushion: number;
  upgradeGear: boolean;
  takeLoan: boolean;
  /** Refuse this month's scam offer, if there is one. */
  resistScam: boolean;
  /** Share of this month's income locked in a term deposit, 0 to 1. Ignored when the voyage offers no deposit. */
  deposit: number;
  /** The port whose market the catch is sold in. Missing or the month's own port means the home port. Ignored when the voyage has no markets. */
  market?: string;
};

export const DEFAULT_PICK: MonthPick = { insure: false, route: "coast", toTax: 0, toCushion: 0, upgradeGear: false, takeLoan: false, resistScam: false, deposit: 0 };

/** Months with a season factor below this count as winter for the "survived winter" check. */
export const WINTER_SEASON = 0.3;

export type VoyageState = {
  cash: number;
  tax: number;
  cushion: number;
  debt: number;
  gear: number;
  /** Tax owed but not yet due. Paid out of the tax jar in due months. */
  liability: number;
  /** Term deposits not yet matured. Locked: no bill can touch them. `matures` is the 1-based month whose end pays them out. */
  locked: { amount: number; matures: number }[];
};

export type MonthRecord = {
  month: number;
  name: string;
  port: string;
  event: string;
  /** The route that was actually sailed (open water is turned into the coast when the lagoon is frozen). */
  route: Route;
  weather: Weather;
  income: number;
  weatherCost: number;
  insured: boolean;
  premium: number;
  /** Money the policy paid back toward this month's repairs. */
  claimed: number;
  /** Interest the cushion earned at the end of the month. */
  interestEarned: number;
  /** The port the catch was sold in. */
  market: string;
  /** The price multiplier that port paid this month (1 at home). */
  priceMultiplier: number;
  /** The trip to that port, charged as a bill (0 at home). */
  travelCost: number;
  /** What choosing this market was worth against selling at home: the extra income minus the trip. Negative when it lost. */
  marketNet: number;
  /** What the player asked to lock this month, after the 100 % ceiling and before the bank's reserve rule. */
  depositAsked: number;
  /** Money locked into a term deposit this month. */
  depositedAmount: number;
  /** Deposits that matured at the end of this month: the principal paid back into cash. */
  maturedAmount: number;
  /** The interest those deposits earned. */
  depositInterest: number;
  toTaxAmount: number;
  toCushionAmount: number;
  loanTaken: number;
  /** Everything below up to `wants` is what was DUE this month; `shortfall` is the unpaid part. */
  interest: number;
  installment: number;
  gearBought: number;
  fixedCost: number;
  eventCost: number;
  scamFaced: boolean;
  scamFell: boolean;
  taxDue: number;
  taxFromJar: number;
  taxPenalty: number;
  wants: number;
  shortfall: number;
  /** The part of `shortfall` that went unpaid while a term deposit was locked. It is still owed, so it reduces net worth. */
  unpaidWhileLocked: number;
  /** Pots at the end of the month. */
  cash: number;
  tax: number;
  cushion: number;
  debt: number;
  gear: number;
};

export type VoyageTotals = {
  income: number;
  loanTaken: number;
  fixedCosts: number;
  eventCosts: number;
  weatherCosts: number;
  premiums: number;
  claimed: number;
  interestEarned: number;
  depositedAmount: number;
  maturedAmount: number;
  depositInterest: number;
  travelCosts: number;
  interest: number;
  installments: number;
  taxDue: number;
  taxFromJar: number;
  taxPenalty: number;
  gearBought: number;
  wants: number;
  shortfall: number;
  unpaidWhileLocked: number;
  scamsFaced: number;
  scamsFell: number;
};

export const SCORE_MAX = { winter: 25, cushion: 30, tax: 20, scams: 15, debt: 10 } as const;
export type ScoreParts = { [K in keyof typeof SCORE_MAX]: number };

export type VoyageResult = {
  months: MonthRecord[];
  totals: VoyageTotals;
  final: VoyageState;
  cushionMonths: number;
  netWorth: number;
  survivedWinter: boolean;
  score: { iq: number; parts: ScoreParts };
  lessons: string[];
};

const round2 = (n: number) => Math.round(n * 100) / 100;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export function initialState(v: Voyage): VoyageState {
  return { cash: v.start.cash, tax: v.start.tax, cushion: v.start.cushion, debt: v.start.debt, gear: v.start.gear, liability: 0, locked: [] };
}

const PickSchema = z.object({
  insure: z.boolean().default(false),
  route: z.enum(["coast", "open"]).default("coast"),
  toTax: z.number().min(0).max(1),
  toCushion: z.number().min(0).max(1),
  upgradeGear: z.boolean(),
  takeLoan: z.boolean(),
  resistScam: z.boolean(),
  deposit: z.number().min(0).max(1).default(0),
  market: z.string().min(1).optional(),
});

/** Validates raw input. Unknown fields are dropped, anything malformed throws InvalidPicksError. */
export function parsePicks(v: Voyage, picks: unknown): MonthPick[] {
  const parsed = z.array(PickSchema).length(v.months.length).safeParse(picks);
  if (!parsed.success) throw new InvalidPicksError();
  // a market must be a port of this voyage; anything else is a forged pick, not a quiet fallback to home
  const ports = new Set(v.ports.map((p) => p.slug));
  if (parsed.data.some((p) => p.market !== undefined && !ports.has(p.market))) throw new InvalidPicksError();
  return parsed.data;
}

/** Pays from cash, then from the cushion. Returns the part that could not be paid. */
function pay(st: VoyageState, amount: number): number {
  let rest = round2(amount);
  const fromCash = Math.min(st.cash, rest);
  st.cash = round2(st.cash - fromCash);
  rest = round2(rest - fromCash);
  if (rest > 0) {
    const fromCushion = Math.min(st.cushion, rest);
    st.cushion = round2(st.cushion - fromCushion);
    rest = round2(rest - fromCushion);
  }
  return rest;
}

/** What upgrading would cost this month, or null when the gear is already at its top level. */
export function upgradePrice(v: Voyage, gear: number, monthIndex: number): number | null {
  if (gear >= v.gear.maxLevel) return null;
  const discount = v.events[v.months[monthIndex].event].gearDiscount ?? 1;
  return round2(v.gear.upgradeCost[gear] * discount);
}

/**
 * `liquid` is pocket cash plus the cushion. An upgrade must leave enough of it to cover this month's
 * fixed bill, so buying gear can never cause a shortfall by itself.
 */
export function canUpgrade(v: Voyage, liquid: number, gear: number, monthIndex: number): boolean {
  const price = upgradePrice(v, gear, monthIndex);
  return price !== null && liquid >= price + v.fixedMonthlyCost;
}

/** Income of month `index` at the given gear level. The UI previews it and the engine books it, from this one function. */
export function incomeFor(v: Voyage, gear: number, index: number, route: Route = "coast", market?: string): number {
  const ev = v.events[v.months[index].event];
  const sailed = route === "open" && canSailOpen(v, index) ? v.openWater.incomeMultiplier[v.months[index].weather] : 1;
  return round2(v.baseIncome * v.months[index].season * v.gear.incomeMultiplier[gear - 1] * (ev.incomeMultiplier ?? 1) * sailed * priceAt(v, index, market));
}

/** The port the player actually sells in: the picked one if this voyage has markets, otherwise the month's home port. */
export function marketFor(v: Voyage, index: number, market?: string): string {
  return v.markets && market !== undefined ? market : v.months[index].port;
}

/** What the picked port pays this month: 1 at home, or when the voyage has no markets, or the port has no listed price. */
export function priceAt(v: Voyage, index: number, market?: string): number {
  const port = marketFor(v, index, market);
  if (!v.markets || port === v.months[index].port) return 1;
  return v.markets.prices[index][port] ?? 1;
}

/** The trip to the picked port: nothing at home. */
export function tripCost(v: Voyage, index: number, market?: string): number {
  const port = marketFor(v, index, market);
  return v.markets && port !== v.months[index].port ? v.markets.travelCost : 0;
}

export type MarketOption = {
  port: string;
  name: string;
  home: boolean;
  /** The price multiplier this port pays this month. */
  price: number;
  /** The income the month would book here (open-water and gear effects included). */
  income: number;
  travelCost: number;
  /** Income here minus income at home, minus the trip. Zero at home. */
  net: number;
};

/**
 * Every port's offer this month, from the same `incomeFor` the engine books with, so the planning screen cannot show a
 * number the game will not pay. Empty when the voyage has no markets.
 */
export function marketOptions(v: Voyage, gear: number, index: number, route: Route): MarketOption[] {
  if (!v.markets) return [];
  const homePort = v.months[index].port;
  const homeIncome = incomeFor(v, gear, index, route, homePort);
  return v.ports.map((p) => {
    const income = incomeFor(v, gear, index, route, p.slug);
    const travelCost = tripCost(v, index, p.slug);
    return { port: p.slug, name: p.name, home: p.slug === homePort, price: priceAt(v, index, p.slug), income, travelCost, net: round2(income - homeIncome - travelCost) };
  });
}

/** Open water is closed while the lagoon is frozen. */
export function canSailOpen(v: Voyage, index: number): boolean {
  return !v.months[index].frozen;
}

export type MonthSplit = {
  /** Deposits whose term ends this month, paid back before the split. */
  maturedAmount: number;
  depositInterest: number;
  /** Income plus the matured deposit: the amount the shares are shares of. */
  available: number;
  toTax: number;
  toCushion: number;
  /** What will really be locked: the request, scaled into the 100 % ceiling, then capped by the reserve rule. */
  toDeposit: number;
  /** What the player asked to lock, after the 100 % ceiling and before the reserve cap. */
  asked: number;
};

/**
 * How one month's money is divided. Pure: it reads the state and the pick and changes nothing.
 *
 * A deposit whose term ends this month pays out BEFORE the split, as a windfall on top of the month's income, so the
 * player decides what it becomes. Left in cash it would leak into wants like any pocket money, which is the lesson.
 * The shares can never exceed what is available. The bank will not lock money the player needs for this month's bill
 * (the same principle as `canUpgrade`): what is locked can never leave cash plus cushion below one month of fixed
 * costs, so a deposit cannot cause a shortfall by itself. The tax jar belongs to the tax office and is not counted.
 */
export function splitMonth(v: Voyage, st: VoyageState, pick: MonthPick, index: number, income: number): MonthSplit {
  let maturedAmount = 0;
  let depositInterest = 0;
  if (v.deposit) {
    for (const d of st.locked) {
      if (d.matures === index + 1) {
        maturedAmount = round2(maturedAmount + d.amount);
        depositInterest = round2(depositInterest + d.amount * ((1 + v.deposit.monthlyRate) ** v.deposit.termMonths - 1));
      }
    }
  }
  const available = round2(income + maturedAmount + depositInterest);

  let toTax = available * pick.toTax;
  let toCushion = available * pick.toCushion;
  let toDeposit = v.deposit ? available * pick.deposit : 0;
  const total = toTax + toCushion + toDeposit;
  if (total > available) {
    const k = available / total;
    toTax *= k;
    toCushion *= k;
    toDeposit *= k;
  }
  toTax = round2(toTax);
  toCushion = round2(toCushion);
  toDeposit = round2(toDeposit);
  const asked = toDeposit;
  if (toDeposit > 0) {
    // what the player holds in cash and cushion once tax is set aside and before anything is locked
    const liquidBeforeLocking = st.cash + st.cushion + available - toTax;
    const room = Math.max(0, round2(liquidBeforeLocking - v.fixedMonthlyCost));
    toDeposit = Math.min(toDeposit, room);
  }
  return { maturedAmount, depositInterest, available, toTax, toCushion, toDeposit, asked };
}

export type DepositPreview = {
  /** False when the voyage has no deposit: the planning screen shows nothing. */
  offered: boolean;
  /** What will really be locked. */
  locked: number;
  /** What the player asked for, within the 100 % ceiling. */
  asked: number;
  /** True when the bank locks less than was asked (the player needs that money for this month's bill). */
  cut: boolean;
  /** Interest the locked money will earn over the whole term. */
  interest: number;
  /** The 1-based month at whose start the money comes back. */
  returnsInMonth: number;
  /** A deposit paying out this month: its principal plus interest, ready to be split. */
  windfall: number;
  /** What the month's split really sets aside (tax, cushion and deposit together), of `available`. */
  setAside: number;
  /** Income plus any matured deposit: what the shares are shares of. */
  available: number;
};

/** What the planning screen tells the player about a deposit, from the same `splitMonth` the engine books with. */
export function depositPreview(v: Voyage, st: VoyageState, pick: MonthPick, index: number): DepositPreview {
  const income = incomeFor(v, st.gear, index, pick.route === "open" && canSailOpen(v, index) ? "open" : "coast", marketFor(v, index, pick.market));
  const sp = splitMonth(v, st, pick, index, income);
  const setAside = round2(sp.toTax + sp.toCushion + sp.toDeposit);
  if (!v.deposit) return { offered: false, locked: 0, asked: 0, cut: false, interest: 0, returnsInMonth: 0, windfall: 0, setAside, available: sp.available };
  return {
    setAside,
    available: sp.available,
    offered: true,
    locked: sp.toDeposit,
    asked: sp.asked,
    cut: sp.toDeposit < sp.asked,
    interest: round2(sp.toDeposit * ((1 + v.deposit.monthlyRate) ** v.deposit.termMonths - 1)),
    returnsInMonth: index + 1 + v.deposit.termMonths,
    windfall: round2(sp.maturedAmount + sp.depositInterest),
  };
}

export function playMonth(v: Voyage, prev: VoyageState, pick: MonthPick, index: number): { state: VoyageState; record: MonthRecord } {
  const spec = v.months[index];
  const ev = v.events[spec.event];
  const st: VoyageState = { ...prev };
  let shortfall = 0;
  const owe = (amount: number) => {
    shortfall = round2(shortfall + pay(st, amount));
  };

  // 1. income, and the player's split into the jars (the split can never exceed the income)
  const route: Route = pick.route === "open" && canSailOpen(v, index) ? "open" : "coast";
  const market = marketFor(v, index, pick.market);
  const income = incomeFor(v, st.gear, index, route, market);
  const homeIncome = incomeFor(v, st.gear, index, route, v.months[index].port);
  const travelCost = tripCost(v, index, market);

  // Where this month's money goes: the split of income and any matured deposit, with the deposit capped. One function,
  // shared with the planning screen's preview, so what the player is told is what the engine does.
  const sp = splitMonth(v, st, pick, index, income);
  const { maturedAmount, depositInterest, available, toTax, toCushion, toDeposit } = sp;
  if (v.deposit) st.locked = st.locked.filter((d) => d.matures !== index + 1);
  st.cash = round2(st.cash + available - toTax - toCushion - toDeposit);
  st.tax = round2(st.tax + toTax);
  st.cushion = round2(st.cushion + toCushion);
  st.liability = round2(st.liability + income * v.taxRate);
  // The deposit is locked from now until the end of month `index + 1 + termMonths`. Nothing below can spend it.
  st.locked = [...st.locked];
  if (toDeposit > 0 && v.deposit) st.locked.push({ amount: toDeposit, matures: index + 1 + v.deposit.termMonths });
  // What the deposit could have paid: locked principal held while this month's bills are settled. A bill left unpaid is
  // still owed; only the part the locked money could have covered counts against the player, so an ordinary shortfall
  // in a run that happens to hold a deposit is not blamed on it.
  const heldLocked = round2(st.locked.reduce((n, d) => n + d.amount, 0));

  // 2. loan service: interest on what is owed, then one installment of the principal
  let interest = 0;
  let installment = 0;
  if (st.debt > 0) {
    interest = round2(st.debt * v.loan.monthlyInterestRate);
    installment = Math.min(st.debt, round2(v.loan.amount / v.loan.termMonths));
    owe(interest);
    const unpaid = pay(st, installment);
    st.debt = round2(st.debt - (installment - unpaid));
    shortfall = round2(shortfall + unpaid);
  }

  // 3. a new loan, only if none is open
  let loanTaken = 0;
  if (pick.takeLoan && st.debt === 0) {
    loanTaken = v.loan.amount;
    st.cash = round2(st.cash + loanTaken);
    st.debt = loanTaken;
  }

  // 4. gear: paid from pocket money first, then from the cushion. Spending savings on a boat that
  // earns more is a real trade-off, because the cushion is what carries the winter.
  let gearBought = 0;
  if (pick.upgradeGear && canUpgrade(v, st.cash + st.cushion, st.gear, index)) {
    gearBought = upgradePrice(v, st.gear, index)!;
    pay(st, gearBought); // the guard above guarantees it is covered
    st.gear += 1;
  }

  // 5. bills and the month's event
  const scamFaced = Boolean(ev.scam);
  const scamFell = scamFaced && !pick.resistScam;
  const eventCost = ev.cost && (!ev.scam || scamFell) ? ev.cost : 0;
  const weatherCost = route === "open" && spec.weather === "storm" ? v.openWater.stormRepair : 0;

  // Insurance reimburses a repair at the moment it is paid, so the claim reaches cash BEFORE the bills are charged.
  // Crediting it afterwards would let a policy cause a shortfall that having no policy would not.
  // The premium is a bill like any other. A claim never covers a scam.
  const insured = pick.insure;
  const premium = insured ? v.insurance.monthlyPremium : 0;
  const claimable = (scamFaced ? 0 : eventCost) + weatherCost;
  const claimed = insured ? round2(claimable * v.insurance.coverage) : 0;
  if (claimed > 0) st.cash = round2(st.cash + claimed);

  owe(v.fixedMonthlyCost);
  if (travelCost > 0) owe(travelCost);
  if (eventCost > 0) owe(eventCost);
  if (weatherCost > 0) owe(weatherCost);
  if (premium > 0) owe(premium);

  // 6. tax, in due months: the jar pays first, anything unfunded costs a penalty on top
  let taxDue = 0;
  let taxFromJar = 0;
  let taxPenalty = 0;
  if (v.taxDueMonths.includes(index + 1)) {
    taxDue = round2(st.liability);
    st.liability = 0;
    taxFromJar = Math.min(st.tax, taxDue);
    st.tax = round2(st.tax - taxFromJar);
    const unfunded = round2(taxDue - taxFromJar);
    taxPenalty = round2(unfunded * v.taxPenaltyRate);
    if (unfunded > 0) owe(unfunded + taxPenalty);
  }

  // 7. the cushion earns interest on what it holds at the end of the month
  const interestEarned = round2(st.cushion * v.savingsRate);
  st.cushion = round2(st.cushion + interestEarned);

  // 8. pocket money above the float leaks into wants
  const wants = round2(Math.max(0, st.cash - v.pocketFloat) * v.wantsRate);
  st.cash = round2(st.cash - wants);

  const record: MonthRecord = {
    month: index + 1,
    name: spec.name,
    port: spec.port,
    event: spec.event,
    route,
    weather: spec.weather,
    income,
    weatherCost,
    insured,
    premium,
    claimed,
    interestEarned,
    market,
    priceMultiplier: priceAt(v, index, market),
    travelCost,
    marketNet: round2(income - homeIncome - travelCost),
    depositAsked: sp.asked,
    depositedAmount: toDeposit,
    maturedAmount,
    depositInterest,
    toTaxAmount: toTax,
    toCushionAmount: toCushion,
    loanTaken,
    interest,
    installment,
    gearBought,
    fixedCost: v.fixedMonthlyCost,
    eventCost,
    scamFaced,
    scamFell,
    taxDue,
    taxFromJar,
    taxPenalty,
    wants,
    shortfall,
    unpaidWhileLocked: round2(Math.min(shortfall, heldLocked)),
    cash: st.cash,
    tax: st.tax,
    cushion: st.cushion,
    debt: st.debt,
    gear: st.gear,
  };
  return { state: st, record };
}

const sum = (rs: MonthRecord[], pick: (r: MonthRecord) => number) => round2(rs.reduce((n, r) => n + pick(r), 0));

export function summarize(v: Voyage, months: MonthRecord[], final: VoyageState): VoyageResult {
  const totals: VoyageTotals = {
    income: sum(months, (r) => r.income),
    loanTaken: sum(months, (r) => r.loanTaken),
    fixedCosts: sum(months, (r) => r.fixedCost),
    eventCosts: sum(months, (r) => r.eventCost),
    weatherCosts: sum(months, (r) => r.weatherCost),
    premiums: sum(months, (r) => r.premium),
    claimed: sum(months, (r) => r.claimed),
    interestEarned: sum(months, (r) => r.interestEarned),
    depositedAmount: sum(months, (r) => r.depositedAmount),
    maturedAmount: sum(months, (r) => r.maturedAmount),
    depositInterest: sum(months, (r) => r.depositInterest),
    travelCosts: sum(months, (r) => r.travelCost),
    interest: sum(months, (r) => r.interest),
    installments: sum(months, (r) => r.installment),
    taxDue: sum(months, (r) => r.taxDue),
    taxFromJar: sum(months, (r) => r.taxFromJar),
    taxPenalty: sum(months, (r) => r.taxPenalty),
    gearBought: sum(months, (r) => r.gearBought),
    wants: sum(months, (r) => r.wants),
    shortfall: sum(months, (r) => r.shortfall),
    unpaidWhileLocked: sum(months, (r) => r.unpaidWhileLocked),
    scamsFaced: months.filter((r) => r.scamFaced).length,
    scamsFell: months.filter((r) => r.scamFell).length,
  };

  const winter = months.filter((_, i) => v.months[i].season < WINTER_SEASON);
  const winterOk = winter.filter((r) => r.shortfall === 0).length;
  const survivedWinter = winterOk === winter.length;
  const cushionMonths = round2(final.cushion / v.fixedMonthlyCost);
  const lockedTotal = final.locked.reduce((n, d) => n + d.amount, 0);
  const netWorth = round2(final.cash + final.tax + final.cushion + lockedTotal - final.debt - totals.unpaidWhileLocked);

  const fullLoanCost = v.loan.amount * v.loan.monthlyInterestRate * ((v.loan.termMonths + 1) / 2);
  const parts: ScoreParts = {
    winter: SCORE_MAX.winter * (winter.length ? winterOk / winter.length : 1),
    cushion: SCORE_MAX.cushion * Math.min(1, cushionMonths / v.cushionTargetMonths),
    tax: SCORE_MAX.tax * (totals.taxDue > 0 ? totals.taxFromJar / totals.taxDue : 1),
    scams: SCORE_MAX.scams * (totals.scamsFaced > 0 ? (totals.scamsFaced - totals.scamsFell) / totals.scamsFaced : 1),
    debt: SCORE_MAX.debt * (1 - Math.min(1, totals.interest / fullLoanCost)),
  };
  const iq = clamp(Math.round(parts.winter + parts.cushion + parts.tax + parts.scams + parts.debt), 0, 100);

  return { months, totals, final, cushionMonths, netWorth, survivedWinter, score: { iq, parts }, lessons: lessonsFor(v, months, totals, cushionMonths, survivedWinter) };
}

/**
 * What a term deposit taught, in at most three sentences and only when it applies. Everything here is read from the
 * records the engine already produced, so the lesson cannot claim something the game did not do.
 */
function depositLessons(v: Voyage, months: MonthRecord[], t: VoyageTotals): string[] {
  if (!v.deposit || (t.depositedAmount === 0 && t.maturedAmount === 0)) return [];
  const out: string[] = [];

  // the bank locked less than the player asked for, because the rest was needed for bills
  const cutMonths = months.filter((r) => r.depositAsked > r.depositedAmount);
  if (cutMonths.length > 0) {
    const refused = sum(cutMonths, (r) => r.depositAsked - r.depositedAmount);
    out.push(
      `Terminuotame indėlyje prašei užrakinti daugiau, nei buvo saugu: ${formatEur(refused)} paliko kišenėje sąskaitoms. Prieš užrakindamas pinigus palik tiek, kad užtektų bent vieno mėnesio išlaidoms.`,
    );
  }

  // what became of the money when it came back: kept (cushion or tax jar) or left to leak into spending
  const back = months.filter((r) => r.maturedAmount + r.depositInterest > 0);
  if (back.length > 0) {
    const windfall = sum(back, (r) => r.maturedAmount + r.depositInterest);
    const saved = sum(back, (r) => Math.min(r.maturedAmount + r.depositInterest, r.toCushionAmount + r.toTaxAmount));
    const leaked = sum(back, (r) => r.wants);
    if (saved >= windfall * 0.7) {
      out.push(
        `Terminuotas indėlis grįžo su ${formatEur(t.depositInterest)} palūkanų, ir tu atidėjai jį vėl, o ne išleidai. Indėlis moka daugiau nei pagalvė, bet tik jei pinigų neliesi, kol jis baigiasi.`,
      );
    } else if (leaked > 0) {
      out.push(
        `Kai terminuotas indėlis grįžo, didelė suma atsidūrė kišenėje ir ${formatEur(leaked)} nutekėjo norams. Grįžusius pinigus iškart atidėk, nes kišenėje jie išgaruoja greičiau nei dirba.`,
      );
    }
  }

  if (t.unpaidWhileLocked > 0) {
    out.push(
      `Dalies sąskaitų nesumokėjai, nors ${formatEur(t.unpaidWhileLocked)} buvo užrakinta indėlyje. Užrakintais pinigais sąskaitų nesumokėsi, todėl rezervą sąskaitoms laikyk pagalvėje, o indėlyje tik tai, ko mėnesius neprireiks.`,
    );
  }
  return out;
}

/**
 * What choosing where to sell taught, in at most three sentences and only when it applies. It is read from the records
 * and from `marketOptions` (the same function the planning screen used), so it never claims a price the game did not offer.
 */
function marketLessons(v: Voyage, months: MonthRecord[]): string[] {
  if (!v.markets) return [];
  const out: string[] = [];
  const travelled = months.filter((r) => r.travelCost > 0);
  const won = travelled.filter((r) => r.marketNet > 0);
  const lost = travelled.filter((r) => r.marketNet < 0);

  if (won.length > 0) {
    const gain = sum(won, (r) => r.marketNet);
    out.push(`Kelionė į kitą uostą atsipirko ${won.length} ${pluralLt(won.length, "kartą", "kartus", "kartų")}: po kelionės kainos liko ${formatEur(gain)} daugiau. Prieš plaukdamas palygink skirtumą su kelionės kaina.`);
  }
  if (lost.length > 0) {
    const loss = -sum(lost, (r) => r.marketNet);
    out.push(`Kelionė į kitą uostą nenusimokėjo ${lost.length} ${pluralLt(lost.length, "kartą", "kartus", "kartų")} ir kainavo ${formatEur(loss)}. Mažesnė kaina ir kelionė kartu yra dvigubas nuostolis.`);
  }

  // a better port was on offer and the player stayed home: what the best trip would have been worth
  const skipped = months
    .map((r, i) => {
      if (r.travelCost > 0) return 0;
      const best = Math.max(0, ...marketOptions(v, i === 0 ? v.start.gear : months[i - 1].gear, i, r.route).map((o) => o.net));
      return best;
    })
    .filter((n) => n > 0);
  if (skipped.length > 0) {
    out.push(`Praleidai ${skipped.length} ${pluralLt(skipped.length, "progą", "progas", "progų")} parduoti brangiau kitame uoste, kur po kelionės kainos būtum uždirbęs iki ${formatEur(Math.max(...skipped))} daugiau per mėnesį. Kainos uostuose kinta, todėl kiekvieną mėnesį pasižiūrėk, kur mokama daugiau.`);
  }
  return out;
}

function lessonsFor(v: Voyage, months: MonthRecord[], t: VoyageTotals, cushionMonths: number, survivedWinter: boolean): string[] {
  const out: string[] = [];
  if (t.scamsFell > 0) {
    const lost = sum(months.filter((r) => r.scamFell), (r) => r.eventCost);
    out.push(
      `Pakliuvai ant sukčių ${t.scamsFell} ${pluralLt(t.scamsFell, "kartą", "kartus", "kartų")} ir praradai ${formatEur(lost)}. Kas prašo pinigų iš anksto ir žada daugiau, beveik visada meluoja.`,
    );
  }
  const burned = months.filter((r, i) => r.route === "open" && r.weather === "storm" && v.months[i].forecast !== "storm");
  const warned = months.filter((r, i) => r.route === "open" && r.weather === "storm" && v.months[i].forecast === "storm");
  if (burned.length > 0) {
    out.push(
      `Plaukei atvira marių dalimi, nors prognozė žadėjo ramesnį orą, ir užklupo audra. Prognozė gali klysti, todėl atviram vandeniui turėk pagalvę, kuri išlaikytų prastą mėnesį. Audros remontas kainavo ${formatEur(sum(burned, (r) => r.weatherCost))}.`,
    );
  } else if (warned.length > 0) {
    out.push(`Plaukei atvira marių dalimi, nors prognozė žadėjo audrą. Didesnis uždarbis neverta rizikos, kai blogą orą žinai iš anksto.`);
  }
  // insurance: say what it did, in the three ways a year can go
  const repairedBare = months.filter((r) => !r.insured && !r.scamFell && r.eventCost + r.weatherCost > 0);
  const bareCost = sum(repairedBare, (r) => r.eventCost + r.weatherCost);
  if (t.claimed > 0 && t.claimed > t.premiums * 0.6) {
    out.push(`Draudimas padengė ${formatEur(t.claimed)} remonto, o įmokų sumokėjai ${formatEur(t.premiums)}. Draudimas verta tada, kai gali nutikti sąskaita, kurios nepakeltum iš kišenės.`);
  } else if (t.premiums > 0 && t.claimed < t.premiums) {
    out.push(`Draudimo įmokoms išleidai ${formatEur(t.premiums)}, o atgavai tik ${formatEur(t.claimed)}. Įmokos kainuoja kiekvieną mėnesį, todėl apsidrausk tada, kai laukia pavojingi mėnesiai, o ne visus metus iš eilės.`);
  }
  if (repairedBare.length > 0 && bareCost >= v.insurance.monthlyPremium * 3) {
    out.push(`Be draudimo pats sumokėjai ${formatEur(bareCost)} remontų. Viena įmoka kainavo tik ${formatEur(v.insurance.monthlyPremium)}, todėl prieš sezoną, kai gresia gedimai, apsvarstyk draudimą.`);
  }
  out.push(...depositLessons(v, months, t));
  out.push(...marketLessons(v, months));
  if (t.taxPenalty > 0) {
    out.push(
      `Mokesčiams neatidėjai pakankamai, todėl papildomai sumokėjai ${formatEur(t.taxPenalty)} baudų. Dalį kiekvienų pajamų atidėk mokesčiams iškart, kai jas gauni.`,
    );
  }
  if (t.interest > 0) {
    out.push(`Paskola kainavo ${formatEur(t.interest)} palūkanų. Skolintis verta tik tada, kai pinigai uždirba daugiau, nei kainuoja palūkanos.`);
  }
  if (!survivedWinter) {
    out.push(`Žiemą pritrūko pinigų sąskaitoms: neapmokėta ${formatEur(t.shortfall)}. Vasarą uždirbtų pinigų turi pakakti ir žiemai.`);
  }
  if (cushionMonths < v.cushionTargetMonths) {
    out.push(
      `Metų pabaigoje pagalvės užtenka ${formatNumber(cushionMonths, 1)} mėn. išlaidų, o tikslas yra ${formatNumber(v.cushionTargetMonths)}. Dalį kiekvienų vasaros pajamų perkelk į pagalvę.`,
    );
  } else {
    out.push(`Sukaupei pagalvę, kurios užtenka ${formatNumber(cushionMonths, 1)} mėn. išlaidų. Su tokia atsarga žiemos nebaisios.`);
  }
  if (t.income > 0 && t.wants > 0.2 * t.income) {
    out.push(`Norams nutekėjo ${formatEur(t.wants)}. Kišenėje paliktus pinigus lengva išleisti, todėl tai, ko nenori išleisti, iškart perkelk į indą.`);
  }
  return out;
}

export function replayVoyage(v: Voyage, picks: unknown): VoyageResult {
  const parsed = parsePicks(v, picks);
  let state = initialState(v);
  const months: MonthRecord[] = [];
  parsed.forEach((p, i) => {
    const r = playMonth(v, state, p, i);
    state = r.state;
    months.push(r.record);
  });
  return summarize(v, months, state);
}
