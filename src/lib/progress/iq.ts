/** Finansinis IQ is a whole number from 0 to 100. */
export function applyIqGain(current: number, gain: number): number {
  return Math.min(100, Math.max(0, Math.round(current + gain)));
}
