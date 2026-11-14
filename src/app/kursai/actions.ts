"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { InvalidPicksError, NotReadyError } from "@/lib/errors";
import { completeLesson, submitQuiz, type ProgressResult, type QuizSubmission } from "@/server/progress";

export type LessonActionResult = { ok: true; progress: ProgressResult } | { ok: false; error: string };
export type QuizActionResult = { ok: true; result: QuizSubmission } | { ok: false; error: string };

export async function completeLessonAction(courseSlug: string, lessonSlug: string): Promise<LessonActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Prisijunkite, kad pažanga būtų išsaugota." };
  try {
    const progress = await completeLesson(user.id, courseSlug, lessonSlug);
    revalidatePath(`/kursai/${courseSlug}`);
    return { ok: true, progress };
  } catch (e) {
    if (e instanceof InvalidPicksError) return { ok: false, error: "Tokios pamokos nėra." };
    throw e;
  }
}

export async function submitQuizAction(courseSlug: string, answers: unknown): Promise<QuizActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Prisijunkite, kad galėtumėte laikyti testą." };
  try {
    const result = await submitQuiz(user.id, courseSlug, answers);
    revalidatePath(`/kursai/${courseSlug}`);
    return { ok: true, result };
  } catch (e) {
    if (e instanceof NotReadyError) return { ok: false, error: "Pirmiausia perskaityk visas kurso pamokas." };
    if (e instanceof InvalidPicksError) return { ok: false, error: "Atsakymų nepavyko patikrinti. Atnaujink puslapį ir bandyk dar kartą." };
    throw e;
  }
}
