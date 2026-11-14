import { describe, expect, it } from "vitest";
import { monthsToCushion } from "./cushion";

describe("monthsToCushion", () => {
  it("counts months needed to reach the target", () => {
    expect(monthsToCushion({ monthlyExpenses: 900, currentSavings: 0, monthlySaving: 300, targetMonths: 3 })).toBe(9);
  });
  it("rounds partial months up", () => {
    expect(monthsToCushion({ monthlyExpenses: 1000, currentSavings: 0, monthlySaving: 400, targetMonths: 3 })).toBe(8);
  });
  it("returns 0 when the cushion already exists", () => {
    expect(monthsToCushion({ monthlyExpenses: 900, currentSavings: 3000, monthlySaving: 100, targetMonths: 3 })).toBe(0);
  });
  it("returns null when nothing is saved and the target is not reached", () => {
    expect(monthsToCushion({ monthlyExpenses: 900, currentSavings: 0, monthlySaving: 0, targetMonths: 3 })).toBeNull();
  });
  it("returns null for zero expenses (no meaningful target)", () => {
    expect(monthsToCushion({ monthlyExpenses: 0, currentSavings: 0, monthlySaving: 100, targetMonths: 3 })).toBeNull();
  });
});
