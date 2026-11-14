import { describe, expect, it } from "vitest";
import { BADGES, evaluateBadges, type ProgressSnapshot } from "./badges";

const empty: ProgressSnapshot = {
  lessonsCompleted: 0,
  coursesCompleted: 0,
  bestBudgetIq: 0,
  bestFraudPct: 0,
  taxRuns: 0,
  cushionPlanMonths: null,
  streak: 0,
  bestVoyageIq: 0,
};
const with_ = (p: Partial<ProgressSnapshot>) => evaluateBadges({ ...empty, ...p });

describe("evaluateBadges", () => {
  it("awards nothing to a brand-new learner", () => {
    expect(with_({})).toEqual([]);
  });
  it("pirmas-zingsnis after the first lesson", () => {
    expect(with_({ lessonsCompleted: 1 })).toContain("pirmas-zingsnis");
  });
  it("kurso-baigimas after one finished course", () => {
    expect(with_({ coursesCompleted: 0 })).not.toContain("kurso-baigimas");
    expect(with_({ coursesCompleted: 1 })).toContain("kurso-baigimas");
  });
  it("budrus-detektyvas needs a budget IQ of 90 or more", () => {
    expect(with_({ bestBudgetIq: 89 })).not.toContain("budrus-detektyvas");
    expect(with_({ bestBudgetIq: 90 })).toContain("budrus-detektyvas");
  });
  it("sukciu-medziotojas needs 80% or more in the fraud game", () => {
    expect(with_({ bestFraudPct: 79 })).not.toContain("sukciu-medziotojas");
    expect(with_({ bestFraudPct: 80 })).toContain("sukciu-medziotojas");
  });
  it("mokesciu-keliautojas after one labyrinth run", () => {
    expect(with_({ taxRuns: 0 })).not.toContain("mokesciu-keliautojas");
    expect(with_({ taxRuns: 1 })).toContain("mokesciu-keliautojas");
  });
  it("pagalves-architektas needs a plan of at least 3 months", () => {
    expect(with_({ cushionPlanMonths: null })).not.toContain("pagalves-architektas");
    expect(with_({ cushionPlanMonths: 2 })).not.toContain("pagalves-architektas");
    expect(with_({ cushionPlanMonths: 3 })).toContain("pagalves-architektas");
  });
  it("savaites-serija needs a 7 day streak", () => {
    expect(with_({ streak: 6 })).not.toContain("savaites-serija");
    expect(with_({ streak: 7 })).toContain("savaites-serija");
  });
  it("ziemos-kapitonas needs a voyage score of 75 or more", () => {
    expect(with_({ bestVoyageIq: 74 })).not.toContain("ziemos-kapitonas");
    expect(with_({ bestVoyageIq: 75 })).toContain("ziemos-kapitonas");
  });
  it("every awarded slug exists in BADGES", () => {
    const all = with_({
      lessonsCompleted: 9,
      coursesCompleted: 9,
      bestBudgetIq: 100,
      bestFraudPct: 100,
      taxRuns: 9,
      cushionPlanMonths: 6,
      streak: 30,
      bestVoyageIq: 100,
    });
    const known = new Set(BADGES.map((b) => b.slug));
    for (const slug of all) expect(known.has(slug)).toBe(true);
    expect(all).toHaveLength(BADGES.length);
  });
});
