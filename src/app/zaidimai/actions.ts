"use server";

import { getCurrentUser } from "@/lib/auth/session";
import { InvalidPicksError } from "@/lib/errors";
import { submitGameRun, type GameSubmission } from "@/server/progress";

export type RunActionResult = { ok: true; result: GameSubmission } | { ok: false; error: string };

/**
 * Saves a finished run. Only the raw picks are read: the server replays them with the
 * same engine the browser used and stores what that computes.
 */
export async function submitRunAction(gameSlug: string, picks: unknown): Promise<RunActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Prisijunkite, kad rezultatas būtų išsaugotas." };
  try {
    return { ok: true, result: await submitGameRun(user.id, gameSlug, picks) };
  } catch (e) {
    if (e instanceof InvalidPicksError) return { ok: false, error: "Nepavyko patikrinti rezultato. Pabandykite žaisti iš naujo." };
    throw e;
  }
}
