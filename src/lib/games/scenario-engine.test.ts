import { describe, expect, it } from "vitest";
import { InvalidPicksError } from "../errors";
import { getScenario } from "./catalog";
import { replayScenario } from "./scenario-engine";
import { ScenarioSchema, type Scenario } from "./schema";
import { estimateIndividualActivity } from "./tax-rules";

const budget = getScenario("biudzeto-detektyvas")!;
const labyrinth = getScenario("mokesciu-labirintas")!;

/** Best-case or worst-case picks for every step of a scenario. */
function picksFor(s: Scenario, mode: "good" | "bad"): number[] {
  return s.steps.map((step) => {
    if (step.type === "choice") return step.choices.findIndex((c) => c.tone === mode);
    const expected = estimateIndividualActivity(step.incomeEur)[step.quantity];
    return mode === "good" ? expected : expected * 3 + 100;
  });
}

describe("replayScenario: budget detective", () => {
  it("all good picks end with a Finansinis IQ of at least 90", () => {
    const r = replayScenario(budget, picksFor(budget, "good"));
    expect(r.iq).toBeGreaterThanOrEqual(90);
    expect(r.outcomes.every((o) => o.tone === "good")).toBe(true);
  });
  it("all bad picks end with a Finansinis IQ of at most 40", () => {
    const r = replayScenario(budget, picksFor(budget, "bad"));
    expect(r.iq).toBeLessThanOrEqual(40);
    expect(r.outcomes.every((o) => o.tone === "bad")).toBe(true);
  });
  it("is deterministic", () => {
    const picks = picksFor(budget, "good");
    expect(replayScenario(budget, picks)).toEqual(replayScenario(budget, picks));
  });
  it("reports one outcome per step, in order", () => {
    const r = replayScenario(budget, picksFor(budget, "good"));
    expect(r.outcomes.map((o) => o.stepId)).toEqual(budget.steps.map((s) => s.id));
  });
});

describe("replayScenario: tampered or broken input", () => {
  it("rejects a choice index that does not exist", () => {
    const picks = picksFor(budget, "good");
    picks[0] = 99;
    expect(() => replayScenario(budget, picks)).toThrow(InvalidPicksError);
  });
  it("rejects fewer picks than steps", () => {
    expect(() => replayScenario(budget, [0, 0])).toThrow(InvalidPicksError);
  });
  it("rejects more picks than steps", () => {
    expect(() => replayScenario(budget, [...picksFor(budget, "good"), 0])).toThrow(InvalidPicksError);
  });
  it("rejects negative, fractional and non-numeric choice picks", () => {
    for (const bad of [-1, 1.5, Number.NaN, "1", null]) {
      const picks: unknown[] = picksFor(budget, "good");
      picks[0] = bad;
      expect(() => replayScenario(budget, picks)).toThrow(InvalidPicksError);
    }
  });
  it("rejects input that is not an array", () => {
    expect(() => replayScenario(budget, null)).toThrow(InvalidPicksError);
    expect(() => replayScenario(budget, { 0: 1 })).toThrow(InvalidPicksError);
  });
  it("rejects a negative or infinite estimate", () => {
    const base = picksFor(labyrinth, "good");
    const at = labyrinth.steps.findIndex((s) => s.type === "estimate");
    for (const bad of [-5, Number.POSITIVE_INFINITY, Number.NaN]) {
      const picks: unknown[] = [...base];
      picks[at] = bad;
      expect(() => replayScenario(labyrinth, picks)).toThrow(InvalidPicksError);
    }
  });
});

describe("replayScenario: meter limits", () => {
  const mini = ScenarioSchema.parse({
    kind: "scenario",
    slug: "mini",
    title: "Mini",
    summary: "Bandymas",
    minutes: 1,
    intro: "Bandymas",
    hud: { eur: "Pinigai", stress: "Stresas", iq: "IQ" },
    eurMax: 100,
    start: { eur: 50, stress: 90, iq: 95 },
    steps: [
      {
        id: "a",
        type: "choice",
        kind: "text",
        title: "A",
        body: "A",
        choices: [
          { label: "x", tone: "bad", note: "n", effects: { eur: -500, stress: 40, iq: 40 } },
          { label: "y", tone: "good", note: "n", effects: { eur: 0, stress: -200, iq: -200 } },
        ],
      },
    ],
  });
  it("money never drops below zero, stress and IQ stay between 0 and 100", () => {
    expect(replayScenario(mini, [0])).toMatchObject({ eur: 0, stress: 100, iq: 100 });
    expect(replayScenario(mini, [1])).toMatchObject({ eur: 50, stress: 0, iq: 0 });
  });
});

describe("replayScenario: estimate steps (tax labyrinth)", () => {
  const at = labyrinth.steps.findIndex((s) => s.type === "estimate");
  const step = labyrinth.steps[at];
  if (step.type !== "estimate") throw new Error("expected an estimate step");
  const expected = estimateIndividualActivity(step.incomeEur)[step.quantity];

  it("accepts an answer inside the tolerance", () => {
    const picks = picksFor(labyrinth, "good");
    picks[at] = expected * (1 + (step.tolerancePct - 0.5) / 100);
    expect(replayScenario(labyrinth, picks).outcomes[at].tone).toBe("good");
  });
  it("rejects an answer outside the tolerance", () => {
    const picks = picksFor(labyrinth, "good");
    picks[at] = expected * (1 + (step.tolerancePct + 5) / 100);
    expect(replayScenario(labyrinth, picks).outcomes[at].tone).toBe("bad");
  });
  it("puts the expected figure into the feedback note", () => {
    const r = replayScenario(labyrinth, picksFor(labyrinth, "good"));
    expect(r.outcomes[at].note).not.toContain("{");
  });
});
