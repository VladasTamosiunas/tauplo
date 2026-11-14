/**
 * Balance after each month of saving `monthly` euros at the end of every month,
 * with interest compounded monthly at `annualRatePct / 12`.
 * Index 0 is the starting balance (0), so the array has `months + 1` points.
 */
export function projectBalance(monthly: number, annualRatePct: number, months: number): number[] {
  const m = annualRatePct / 100 / 12;
  const out = [0];
  let balance = 0;
  for (let k = 1; k <= months; k++) {
    balance = balance * (1 + m) + monthly;
    out.push(balance);
  }
  return out;
}

export function summarizeProjection(
  monthly: number,
  annualRatePct: number,
  years: number,
): { final: number; contributed: number; growth: number } {
  const months = Math.round(years * 12);
  const final = projectBalance(monthly, annualRatePct, months)[months];
  const contributed = monthly * months;
  return { final, contributed, growth: final - contributed };
}
