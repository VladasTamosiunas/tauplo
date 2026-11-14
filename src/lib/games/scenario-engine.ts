import { InvalidPicksError } from "../errors";
import { formatEur } from "../format";
import type { Effects, Scenario, Step, Tone } from "./schema";
import { estimateIndividualActivity, fillTemplate } from "./tax-rules";

export type Meters = { eur: number; stress: number; iq: number };

export type StepOutcome = {
  stepId: string;
  tone: Tone;
  /** Feedback text with all placeholders filled. */
  note: string;
  effects: Effects;
};

export type RunResult = Meters & { outcomes: StepOutcome[] };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Money cannot go below zero. Stress and IQ stay between 0 and 100. */
export function applyEffects(m: Meters, e: Effects): Meters {
  return {
    eur: Math.max(0, m.eur + e.eur),
    stress: clamp(m.stress + e.stress, 0, 100),
    iq: clamp(m.iq + e.iq, 0, 100),
  };
}

/**
 * Works out what one pick does. The browser calls this for instant feedback and
 * the server calls it again to verify, so both always agree.
 */
export function resolveStep(step: Step, pick: unknown): Omit<StepOutcome, "stepId"> {
  if (step.type === "choice") {
    if (typeof pick !== "number" || !Number.isInteger(pick) || pick < 0 || pick >= step.choices.length) {
      throw new InvalidPicksError();
    }
    const c = step.choices[pick];
    return { tone: c.tone, note: fillTemplate(c.note), effects: c.effects };
  }
  if (typeof pick !== "number" || !Number.isFinite(pick) || pick < 0) throw new InvalidPicksError();
  const expected = estimateIndividualActivity(step.incomeEur)[step.quantity];
  const ok = Math.abs(pick - expected) <= (expected * step.tolerancePct) / 100;
  const outcome = ok ? step.correct : step.wrong;
  return {
    tone: ok ? "good" : "bad",
    note: fillTemplate(outcome.note, { expected: formatEur(expected, 2) }),
    effects: outcome.effects,
  };
}

/** Plays a whole run from the player's picks. Throws InvalidPicksError on anything unexpected. */
export function replayScenario(scenario: Scenario, picks: unknown): RunResult {
  if (!Array.isArray(picks) || picks.length !== scenario.steps.length) throw new InvalidPicksError();
  let meters: Meters = applyEffects({ ...scenario.start }, { eur: 0, stress: 0, iq: 0 });
  const outcomes: StepOutcome[] = [];
  scenario.steps.forEach((step, i) => {
    const r = resolveStep(step, picks[i]);
    meters = applyEffects(meters, r.effects);
    outcomes.push({ stepId: step.id, ...r });
  });
  return { ...meters, outcomes };
}
