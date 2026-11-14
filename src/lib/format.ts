const NBSP = " ";
const MINUS = "−";

function group(intPart: string): string {
  return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
}

/** Lithuanian number format: non-breaking space groups, decimal comma, real minus sign. */
export function formatNumber(n: number, decimals = 0): string {
  const rounded = Number(Math.abs(n).toFixed(decimals));
  const [int, frac] = rounded.toFixed(decimals).split(".");
  const sign = n < 0 && rounded !== 0 ? MINUS : "";
  return sign + group(int) + (frac ? "," + frac : "");
}

/** `12 480,50 €` (the spaces are non-breaking). */
export function formatEur(n: number, decimals = 0): string {
  return formatNumber(n, decimals) + NBSP + "€";
}

/** `3,5 %` (the space is non-breaking). */
export function formatPercent(n: number, decimals = 0): string {
  return formatNumber(n, decimals) + NBSP + "%";
}

/** Lithuanian plural: 1 pamoka, 2 pamokos, 10 pamokų, 21 pamoka. */
export function pluralLt(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 === 0 || (m100 >= 11 && m100 <= 19)) return many;
  return few;
}

/**
 * Makes hand-written content typographically safe: thousands groups and the
 * space before € or % become non-breaking, so a figure never splits over two lines.
 */
export function tidyText(s: string): string {
  return s.replace(/(\d) (?=\d{3}(?!\d))/g, "$1" + NBSP).replace(/ (?=[€%])/g, NBSP);
}

/** `+120` / `−4` / `0`, used for deltas in game feedback. */
export function formatSigned(n: number, suffix = ""): string {
  if (n === 0) return "0" + suffix;
  return (n > 0 ? "+" : MINUS) + formatNumber(Math.abs(n)) + suffix;
}
