import { describe, expect, it } from "vitest";
import { TAX_RULES, estimateIndividualActivity, fillTemplate } from "./tax-rules";

describe("estimateIndividualActivity", () => {
  const r = estimateIndividualActivity(10000);

  it("deducts 30% expenses first", () => {
    expect(r.expenses).toBe(3000);
    expect(r.base).toBe(7000);
  });
  it("charges VSD and PSD on 90% of the base", () => {
    expect(r.vsd).toBeCloseTo(7000 * 0.9 * 0.1252, 2);
    expect(r.psd).toBeCloseTo(7000 * 0.9 * 0.0698, 2);
  });
  it("charges GPM on income minus expenses minus VSD minus PSD", () => {
    expect(r.gpm).toBeCloseTo((7000 - r.vsd - r.psd) * 0.15, 1);
  });
  it("total is the sum of the three contributions and net is income minus total", () => {
    expect(r.total).toBeCloseTo(r.vsd + r.psd + r.gpm, 2);
    expect(r.net).toBeCloseTo(10000 - r.total, 2);
  });
  it("is zero for zero income", () => {
    expect(estimateIndividualActivity(0)).toEqual({ expenses: 0, base: 0, vsd: 0, psd: 0, gpm: 0, total: 0, net: 0 });
  });
  it("accepts custom rules", () => {
    const x = estimateIndividualActivity(1000, { ...TAX_RULES, expensePct: 0, gpmPct: 0 });
    expect(x.expenses).toBe(0);
    expect(x.gpm).toBe(0);
  });
});

describe("TAX_RULES", () => {
  it("is flagged as not yet reviewed by an expert", () => {
    expect(TAX_RULES.reviewed).toBe(false);
  });
});

describe("fillTemplate", () => {
  it("fills rule percentages with a decimal comma", () => {
    expect(fillTemplate("VSD {vsdPct} %, PSD {psdPct} %, GPM {gpmPct} %, išlaidos {expensePct} %")).toBe(
      "VSD 12,52 %, PSD 6,98 %, GPM 15 %, išlaidos 30 %",
    );
  });
  it("fills extra variables and leaves unknown placeholders untouched", () => {
    expect(fillTemplate("Atsakymas {expected} {unknown}", { expected: "175,90 €" })).toBe("Atsakymas 175,90 € {unknown}");
  });
});
