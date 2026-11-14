"use server";

import { getCurrentUser } from "@/lib/auth/session";
import { InvalidPicksError } from "@/lib/errors";
import { saveCushionPlan, type ProgressResult } from "@/server/progress";

export type PlanActionResult = { ok: true; progress: ProgressResult } | { ok: false; error: string };

export async function saveCushionPlanAction(input: unknown): Promise<PlanActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Prisijunkite, kad planas būtų išsaugotas." };
  try {
    return { ok: true, progress: await saveCushionPlan(user.id, input) };
  } catch (e) {
    if (e instanceof InvalidPicksError) return { ok: false, error: "Patikrinkite skaičius: jie turi būti teigiami, o mėnesių skaičius sveikas (1 iki 24)." };
    throw e;
  }
}
