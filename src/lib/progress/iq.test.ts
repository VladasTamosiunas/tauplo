import { describe, expect, it } from "vitest";
import { applyIqGain } from "./iq";

describe("applyIqGain", () => {
  it("adds a gain", () => {
    expect(applyIqGain(40, 12)).toBe(52);
  });
  it("clamps at 100", () => {
    expect(applyIqGain(95, 20)).toBe(100);
  });
  it("never goes below 0", () => {
    expect(applyIqGain(5, -30)).toBe(0);
  });
  it("rounds to a whole number", () => {
    expect(applyIqGain(40, 2.6)).toBe(43);
  });
});
