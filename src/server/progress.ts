import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { generateCertificateId } from "@/lib/codes";
import { getCourse, scoreQuiz, type QuizResult } from "@/lib/courses/catalog";
import { db } from "@/lib/db";
import { InvalidPicksError, NotReadyError } from "@/lib/errors";
import { GAMES, getFraudDeck, getGame, getScenario, getVoyage } from "@/lib/games/catalog";
import { scoreFraud, type FraudScore } from "@/lib/games/fraud-engine";
import { replayScenario, type RunResult } from "@/lib/games/scenario-engine";
import { replayVoyage, type VoyageResult } from "@/lib/games/voyage-engine";
import { goalBonusXp, goalsFor } from "@/lib/games/voyage-goals";
import { evaluateBadges, type ProgressSnapshot } from "@/lib/progress/badges";
import { applyIqGain } from "@/lib/progress/iq";
import { nextStreak, vilniusDateKey } from "@/lib/progress/streak";
import { levelFromXp } from "@/lib/progress/xp";

export const LESSON_XP = 10;
export const QUIZ_IQ_GAIN = 10;
export const CUSHION_XP = 25;
export const GAME_BASE_XP = 20;

const BUDGET_SLUG = "biudzeto-detektyvas";
const TAX_SLUG = "mokesciu-labirintas";
const FRAUD_SLUG = "sukciu-medziokle";
// Every voyage year counts toward the winter-captain badge, so a new year added to the catalog needs no change here.
const VOYAGE_SLUGS = GAMES.filter((g) => g.kind === "voyage").map((g) => g.slug);

type Tx = Prisma.TransactionClient;

export type ProgressResult = {
  xpGained: number;
  iqGained: number;
  newBadges: string[];
  /** The learner's level after this action. */
  level: number;
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/* ---------- shared helpers (all run inside a transaction) ---------- */

/** Adds XP and IQ under a row lock, so simultaneous requests cannot lose an update. */
async function grant(tx: Tx, userId: string, xp: number, iqGain: number) {
  const rows = await tx.$queryRaw<{ xp: number; financialIq: number }[]>`
    SELECT xp, "financialIq" FROM "User" WHERE id = ${userId} FOR UPDATE`;
  const row = rows[0];
  if (!row) throw new Error("Vartotojas nerastas");
  const financialIq = applyIqGain(row.financialIq, iqGain);
  const newXp = row.xp + xp;
  await tx.user.update({ where: { id: userId }, data: { xp: newXp, financialIq } });
  return { xpGained: xp, iqGained: financialIq - row.financialIq, level: levelFromXp(newXp).level };
}

async function unchanged(tx: Tx, userId: string): Promise<ProgressResult> {
  const u = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { xp: true } });
  return { xpGained: 0, iqGained: 0, newBadges: [], level: levelFromXp(u.xp).level };
}

async function snapshot(tx: Tx, userId: string): Promise<ProgressSnapshot> {
  const [user, lessons, courses, budget, fraud, tax, plan, voyage] = await Promise.all([
    tx.user.findUniqueOrThrow({ where: { id: userId }, select: { streakCount: true } }),
    tx.lessonProgress.count({ where: { userId } }),
    tx.courseCompletion.count({ where: { userId } }),
    tx.gameRun.aggregate({ where: { userId, gameSlug: BUDGET_SLUG }, _max: { iq: true } }),
    tx.gameRun.aggregate({ where: { userId, gameSlug: FRAUD_SLUG }, _max: { pct: true } }),
    tx.gameRun.count({ where: { userId, gameSlug: TAX_SLUG } }),
    tx.cushionPlan.findUnique({ where: { userId }, select: { months: true } }),
    tx.gameRun.aggregate({ where: { userId, gameSlug: { in: VOYAGE_SLUGS } }, _max: { iq: true } }),
  ]);
  return {
    lessonsCompleted: lessons,
    coursesCompleted: courses,
    bestBudgetIq: budget._max.iq ?? 0,
    bestFraudPct: fraud._max.pct ?? 0,
    taxRuns: tax,
    cushionPlanMonths: plan?.months ?? null,
    streak: user.streakCount,
    bestVoyageIq: voyage._max.iq ?? 0,
  };
}

/** Stores every badge the learner now qualifies for and returns only the newly earned ones. */
async function awardBadges(tx: Tx, userId: string): Promise<string[]> {
  const eligible = evaluateBadges(await snapshot(tx, userId));
  const have = new Set((await tx.badgeAward.findMany({ where: { userId }, select: { badgeSlug: true } })).map((b) => b.badgeSlug));
  const fresh: string[] = [];
  for (const slug of eligible) {
    if (have.has(slug)) continue;
    const r = await tx.badgeAward.createMany({ data: [{ userId, badgeSlug: slug }], skipDuplicates: true });
    if (r.count === 1) fresh.push(slug);
  }
  return fresh;
}

/* ---------- streak ---------- */

/**
 * Marks today (Vilnius time) as an active day. Safe to call many times and from
 * simultaneous requests: the update only applies if nobody else changed the day first.
 */
export async function touchStreak(userId: string, now: Date = new Date()): Promise<void> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { streakCount: true, longestStreak: true, lastActiveKey: true },
  });
  if (!user) return;
  const today = vilniusDateKey(now);
  const next = nextStreak({ count: user.streakCount, lastKey: user.lastActiveKey }, today);
  if (!next.changed) return;
  await db.user.updateMany({
    where: { id: userId, lastActiveKey: user.lastActiveKey },
    data: { streakCount: next.count, longestStreak: Math.max(user.longestStreak, next.count), lastActiveKey: today },
  });
}

/* ---------- lessons and quizzes ---------- */

export async function completeLesson(userId: string, courseSlug: string, lessonSlug: string): Promise<ProgressResult> {
  const course = getCourse(courseSlug);
  if (!course || !course.lessons.some((l) => l.slug === lessonSlug)) throw new InvalidPicksError();
  await touchStreak(userId);
  return db.$transaction(async (tx) => {
    // INSERT ... ON CONFLICT DO NOTHING: only the request that really inserts the row gets paid.
    const created = await tx.lessonProgress.createMany({ data: [{ userId, courseSlug, lessonSlug }], skipDuplicates: true });
    if (created.count === 0) return unchanged(tx, userId);
    const g = await grant(tx, userId, LESSON_XP, 0);
    const newBadges = await awardBadges(tx, userId);
    return { xpGained: g.xpGained, iqGained: g.iqGained, newBadges, level: g.level };
  });
}

export type QuizSubmission = ProgressResult & { quiz: QuizResult; certificateId: string | null };

export async function submitQuiz(userId: string, courseSlug: string, answers: unknown): Promise<QuizSubmission> {
  const course = getCourse(courseSlug);
  if (!course) throw new InvalidPicksError();
  const quiz = scoreQuiz(course, answers);
  const read = await db.lessonProgress.count({
    where: { userId, courseSlug, lessonSlug: { in: course.lessons.map((l) => l.slug) } },
  });
  if (read < course.lessons.length) throw new NotReadyError();
  await touchStreak(userId);

  return db.$transaction(async (tx) => {
    const existingCertificate = async () =>
      (await tx.certificate.findUnique({ where: { userId_courseSlug: { userId, courseSlug } }, select: { id: true } }))?.id ?? null;

    if (!quiz.passed) return { ...(await unchanged(tx, userId)), quiz, certificateId: await existingCertificate() };

    const created = await tx.courseCompletion.createMany({
      data: [{ userId, courseSlug, quizPct: quiz.pct }],
      skipDuplicates: true,
    });
    if (created.count === 0) return { ...(await unchanged(tx, userId)), quiz, certificateId: await existingCertificate() };

    const g = await grant(tx, userId, course.xp, QUIZ_IQ_GAIN);
    let certificateId: string | null = null;
    if (course.certificate) {
      certificateId = generateCertificateId();
      await tx.certificate.create({ data: { id: certificateId, userId, courseSlug } });
    }
    const newBadges = await awardBadges(tx, userId);
    return { xpGained: g.xpGained, iqGained: g.iqGained, newBadges, level: g.level, quiz, certificateId };
  });
}

/* ---------- games ---------- */

export type GameSubmission = ProgressResult & { summary: RunResult | FraudScore | VoyageResult };

/**
 * Replays the submitted picks on the server and stores what the ENGINE computes.
 * Nothing the browser reports about its own score is read or trusted.
 */
export async function submitGameRun(userId: string, gameSlug: string, picks: unknown): Promise<GameSubmission> {
  const game = getGame(gameSlug);
  if (!game) throw new InvalidPicksError();

  let stored: { iq?: number; eur?: number; stress?: number; points?: number; pct?: number };
  let xp: number;
  let iqGain: number;
  let summary: RunResult | FraudScore | VoyageResult;

  if (game.kind === "voyage") {
    // The whole year is replayed here from the twelve raw decisions; nothing the browser computed is read.
    const voyage = getVoyage(gameSlug)!;
    const result = replayVoyage(voyage, picks);
    stored = { iq: result.score.iq, eur: Math.round(result.netWorth) };
    // Goals are recomputed here from the replay, so the bonus can never be claimed from the browser.
    xp = GAME_BASE_XP + Math.round(result.score.iq / 2) + goalBonusXp(goalsFor(voyage, result));
    iqGain = clamp(Math.round((result.score.iq - 40) / 4), 0, 15);
    summary = result;
  } else if (game.kind === "scenario") {
    const result = replayScenario(getScenario(gameSlug)!, picks);
    stored = { iq: Math.round(result.iq), eur: Math.round(result.eur), stress: Math.round(result.stress) };
    xp = GAME_BASE_XP + Math.round(result.iq / 2);
    iqGain = clamp(Math.round((result.iq - 40) / 4), 0, 15);
    summary = result;
  } else {
    const score = scoreFraud(getFraudDeck(gameSlug)!, picks);
    stored = { points: score.points, pct: score.pct };
    xp = GAME_BASE_XP + Math.round(score.pct / 2);
    iqGain = Math.round(score.pct / 10);
    summary = score;
  }

  await touchStreak(userId);
  return db.$transaction(async (tx) => {
    await tx.gameRun.create({ data: { userId, gameSlug, ...stored } });
    const g = await grant(tx, userId, xp, iqGain);
    const newBadges = await awardBadges(tx, userId);
    return { xpGained: g.xpGained, iqGained: g.iqGained, newBadges, level: g.level, summary };
  });
}

/* ---------- emergency-fund planner ---------- */

const CushionSchema = z.object({
  monthlyExpenses: z.number().min(1).max(1_000_000),
  currentSavings: z.number().min(0).max(100_000_000),
  monthlySaving: z.number().min(0).max(1_000_000),
  targetMonths: z.number().int().min(1).max(24),
});
export type CushionPlanInput = z.input<typeof CushionSchema>;

/** Saves (replaces) the learner's cushion plan. The first plan earns a little XP. */
export async function saveCushionPlan(userId: string, input: unknown): Promise<ProgressResult> {
  const parsed = CushionSchema.safeParse(input);
  if (!parsed.success) throw new InvalidPicksError();
  const p = parsed.data;
  const data = {
    monthlyExpenses: Math.round(p.monthlyExpenses),
    currentSavings: Math.round(p.currentSavings),
    monthlySaving: Math.round(p.monthlySaving),
    months: p.targetMonths,
  };
  await touchStreak(userId);
  return db.$transaction(async (tx) => {
    const created = await tx.cushionPlan.createMany({ data: [{ userId, ...data }], skipDuplicates: true });
    let g = { xpGained: 0, iqGained: 0, level: 0 };
    if (created.count === 1) {
      g = await grant(tx, userId, CUSHION_XP, 0);
    } else {
      await tx.cushionPlan.update({ where: { userId }, data });
      g.level = (await unchanged(tx, userId)).level;
    }
    const newBadges = await awardBadges(tx, userId);
    return { xpGained: g.xpGained, iqGained: g.iqGained, newBadges, level: g.level };
  });
}

/** The best finished run of one voyage year for this player, or null before the first one. */
export async function bestVoyageRun(userId: string, gameSlug: string): Promise<{ iq: number; eur: number; playedAt: Date } | null> {
  const row = await db.gameRun.findFirst({
    where: { userId, gameSlug },
    orderBy: [{ iq: "desc" }, { eur: "desc" }, { createdAt: "asc" }],
    select: { iq: true, eur: true, createdAt: true },
  });
  return row ? { iq: row.iq, eur: row.eur, playedAt: row.createdAt } : null;
}
