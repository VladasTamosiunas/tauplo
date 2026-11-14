import { z } from "zod";
import { InvalidPicksError } from "../errors";
import type { FraudDeck } from "./schema";

const AnswerSchema = z.object({
  itemId: z.string().min(1).max(100),
  verdict: z.enum(["scam", "safe"]),
  flagIds: z.array(z.string().max(100)).max(50),
  /** Milliseconds the player took. z.number() already rejects NaN and Infinity. */
  ms: z.number().min(0),
});
export type FraudAnswer = z.infer<typeof AnswerSchema>;

export type FraudScore = { correct: number; total: number; points: number; pct: number };

export const POINTS_PER_CORRECT = 100;
export const MAX_SPEED_BONUS = 50;
export const SPEED_WINDOW_MS = 15000;
export const POINTS_PER_FLAG = 10;

/**
 * Scores a fraud-spotter run. Unanswered items count as wrong.
 * Per correct verdict: 100 points, up to 50 speed bonus (linear, gone at 15 s),
 * and on real scams 10 per correctly ticked red flag minus 10 per wrong tick
 * (never below zero, so ticking everything earns nothing).
 */
export function scoreFraud(deck: FraudDeck, answers: unknown): FraudScore {
  const parsed = z.array(AnswerSchema).max(deck.items.length).safeParse(answers);
  if (!parsed.success) throw new InvalidPicksError();

  const byId = new Map(deck.items.map((i) => [i.id, i]));
  const seen = new Set<string>();
  let correct = 0;
  let points = 0;

  for (const a of parsed.data) {
    const item = byId.get(a.itemId);
    if (!item || seen.has(a.itemId)) throw new InvalidPicksError();
    seen.add(a.itemId);

    if ((a.verdict === "scam") !== item.isScam) continue;
    correct++;
    points += POINTS_PER_CORRECT;
    points += Math.round(MAX_SPEED_BONUS * Math.max(0, 1 - a.ms / SPEED_WINDOW_MS));

    if (item.isScam) {
      const real = new Set(item.flags.map((f) => f.id));
      const ticked = new Set(a.flagIds);
      let right = 0;
      let wrong = 0;
      for (const id of ticked) {
        if (real.has(id)) right++;
        else wrong++;
      }
      points += Math.max(0, (right - wrong) * POINTS_PER_FLAG);
    }
  }

  const total = deck.items.length;
  return { correct, total, points, pct: Math.round((correct / total) * 100) };
}
