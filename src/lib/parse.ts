/**
 * Reads a euro amount typed by a person: "175,90", "1 234.5", "1234 €".
 * Returns null for anything that is not a plain non-negative amount with at most two decimals.
 */
export function parseAmount(input: string): number | null {
  const cleaned = input.replace(/[\s €]/g, "").replace(",", ".");
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(cleaned)) return null;
  return Number(cleaned);
}
