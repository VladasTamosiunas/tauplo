import { describe, expect, it } from "vitest";
import { projectBalance, summarizeProjection } from "./compound";

describe("projectBalance", () => {
  it("returns months + 1 points starting at zero", () => {
    const s = projectBalance(120, 3.5, 60);
    expect(s).toHaveLength(61);
    expect(s[0]).toBe(0);
  });
  it("at 0% equals the contributions", () => {
    expect(projectBalance(120, 0, 60)[60]).toBe(7200);
  });
  it("at 3.5% grows to 7856 over five years", () => {
    expect(Math.round(projectBalance(120, 3.5, 60)[60])).toBe(7856);
  });
  it("at 8% grows to 8817 over five years", () => {
    expect(Math.round(projectBalance(120, 8, 60)[60])).toBe(8817);
  });
  it("is non-decreasing", () => {
    const s = projectBalance(50, 8, 60);
    for (let i = 1; i < s.length; i++) expect(s[i]).toBeGreaterThanOrEqual(s[i - 1]);
  });
  it("returns a flat zero series for zero monthly savings", () => {
    expect(projectBalance(0, 8, 12).every((v) => v === 0)).toBe(true);
  });
});

describe("summarizeProjection", () => {
  it("splits the result into contributed money and growth", () => {
    const r = summarizeProjection(120, 8, 5);
    expect(r.contributed).toBe(7200);
    expect(Math.round(r.final)).toBe(8817);
    expect(r.growth).toBeCloseTo(r.final - r.contributed, 6);
  });
});
