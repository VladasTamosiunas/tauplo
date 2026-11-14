export type CushionInput = {
  monthlyExpenses: number;
  currentSavings: number;
  monthlySaving: number;
  targetMonths: number;
};

/**
 * Months of saving needed until savings cover `targetMonths` of expenses.
 * 0 if already there; null if it can never be reached (nothing saved per month,
 * or no expenses to measure against).
 */
export function monthsToCushion(p: CushionInput): number | null {
  if (!(p.monthlyExpenses > 0)) return null;
  const target = p.monthlyExpenses * p.targetMonths;
  if (p.currentSavings >= target) return 0;
  if (!(p.monthlySaving > 0)) return null;
  return Math.ceil((target - p.currentSavings) / p.monthlySaving);
}
