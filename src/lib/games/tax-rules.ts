import { formatNumber } from "../format";

export type TaxRules = {
  version: string;
  /** Expenses assumed without receipts, as % of income. */
  expensePct: number;
  vsdPct: number;
  psdPct: number;
  /** VSD and PSD are charged on this % of (income minus expenses). */
  contributionBasePct: number;
  gpmPct: number;
  /** Becomes true only after a tax expert has checked every number here. */
  reviewed: boolean;
};

/**
 * A simplified TEACHING model of individual activity taxes. It is not tax advice
 * and is not kept in sync with current law. Every number the games and
 * calculators use comes from this one object so it can be corrected in one place.
 */
export const TAX_RULES: TaxRules = {
  version: "mokymosi-modelis",
  expensePct: 30,
  vsdPct: 12.52,
  psdPct: 6.98,
  contributionBasePct: 90,
  gpmPct: 15,
  reviewed: false,
};

export type TaxEstimate = {
  expenses: number;
  base: number;
  vsd: number;
  psd: number;
  gpm: number;
  total: number;
  net: number;
};

const cents = (n: number) => Math.round(n * 100) / 100;

export function estimateIndividualActivity(income: number, rules: TaxRules = TAX_RULES): TaxEstimate {
  const expenses = cents((income * rules.expensePct) / 100);
  const base = cents(income - expenses);
  const contributionBase = (base * rules.contributionBasePct) / 100;
  const vsd = cents((contributionBase * rules.vsdPct) / 100);
  const psd = cents((contributionBase * rules.psdPct) / 100);
  const gpm = cents(Math.max(0, ((base - vsd - psd) * rules.gpmPct) / 100));
  const total = cents(vsd + psd + gpm);
  return { expenses, base, vsd, psd, gpm, total, net: cents(income - total) };
}

const pct = (n: number) => (Number.isInteger(n) ? formatNumber(n) : formatNumber(n, 2));

/**
 * Fills `{expensePct}`, `{vsdPct}`, `{psdPct}`, `{gpmPct}`, `{contributionBasePct}`
 * and any `extra` variables into content text. Unknown placeholders stay as written.
 */
export function fillTemplate(
  text: string,
  extra: Record<string, string> = {},
  rules: TaxRules = TAX_RULES,
): string {
  const vars: Record<string, string> = {
    expensePct: pct(rules.expensePct),
    vsdPct: pct(rules.vsdPct),
    psdPct: pct(rules.psdPct),
    contributionBasePct: pct(rules.contributionBasePct),
    gpmPct: pct(rules.gpmPct),
    ...extra,
  };
  return text.replace(/\{(\w+)\}/g, (whole, key: string) => (key in vars ? vars[key] : whole));
}
