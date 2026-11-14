import { Prisma, type Classroom, type ClassroomKind } from "@prisma/client";
import { z } from "zod";
import { generateJoinCode, normalizeJoinCode } from "@/lib/codes";
import { getCourse } from "@/lib/courses/catalog";
import { db } from "@/lib/db";
import { GAMES } from "@/lib/games/catalog";
import { levelFromXp } from "@/lib/progress/xp";
import { TOPICS, type TopicSlug } from "@/lib/topics";

/** Class statistics are shown only when at least this many learners contribute. */
export const MIN_COHORT = 3;

const NameSchema = z.string().trim().min(1, "Įveskite pavadinimą.").max(80, "Pavadinimas per ilgas (iki 80 simbolių).");

export async function createClassroom(
  ownerId: string,
  input: { name: string; kind: ClassroomKind },
): Promise<Classroom> {
  const name = NameSchema.parse(input.name);
  const owner = await db.user.findUnique({ where: { id: ownerId }, select: { role: true } });
  if (!owner || owner.role !== "TEACHER") throw new Error("Klases gali kurti tik mokytojai ir institucijų atstovai.");

  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      return await db.classroom.create({ data: { name, kind: input.kind, ownerId, joinCode: generateJoinCode() } });
    } catch (e) {
      // Two rooms drew the same code: draw another.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") continue;
      throw e;
    }
  }
  throw new Error("Nepavyko sukurti prisijungimo kodo. Bandykite dar kartą.");
}

export type JoinResult = { ok: true; classroomName: string } | { ok: false; error: string };

export async function joinClassroom(userId: string, rawCode: string): Promise<JoinResult> {
  const code = normalizeJoinCode(rawCode);
  if (!code) return { ok: false, error: "Įveskite klasės arba kampanijos kodą." };
  const [user, room] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { role: true } }),
    db.classroom.findUnique({ where: { joinCode: code }, select: { id: true, name: true } }),
  ]);
  if (!user) return { ok: false, error: "Pirmiausia prisijunkite." };
  if (user.role === "TEACHER") return { ok: false, error: "Mokytojai prisijungti prie klasių kaip mokiniai negali." };
  if (!room) return { ok: false, error: "Tokio kodo neradome. Patikrinkite jį ir bandykite dar kartą." };
  await db.membership.createMany({ data: [{ userId, classroomId: room.id }], skipDuplicates: true });
  return { ok: true, classroomName: room.name };
}

export type ClassroomSummary = {
  id: string;
  name: string;
  kind: ClassroomKind;
  joinCode: string;
  members: number;
  createdAt: Date;
};

export async function listClassrooms(ownerId: string): Promise<ClassroomSummary[]> {
  const rooms = await db.classroom.findMany({
    where: { ownerId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { members: true } } },
  });
  return rooms.map((r) => ({
    id: r.id,
    name: r.name,
    kind: r.kind,
    joinCode: r.joinCode,
    members: r._count.members,
    createdAt: r.createdAt,
  }));
}

/** Rooms a learner has joined (names only). */
export async function listJoinedClassrooms(userId: string): Promise<{ id: string; name: string }[]> {
  const rows = await db.membership.findMany({
    where: { userId },
    orderBy: { joinedAt: "desc" },
    select: { classroom: { select: { id: true, name: true } } },
  });
  return rows.map((r) => r.classroom);
}

export type ClassroomStats =
  | { members: number; hidden: true }
  | {
      members: number;
      hidden: false;
      avgIq: number;
      coursesCompleted: number;
      gameRuns: number;
      topics: { slug: TopicSlug; name: string; pct: number }[];
    };

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/**
 * Anonymous aggregate for the teacher who owns the room. Returns null for anyone else.
 * With fewer than MIN_COHORT members nothing but the head count is returned, and a topic
 * is left out unless at least MIN_COHORT learners contributed to it. Never contains
 * names, emails or ids of learners.
 */
export async function classroomStats(classroomId: string, ownerId: string): Promise<ClassroomStats | null> {
  const room = await db.classroom.findFirst({ where: { id: classroomId, ownerId }, select: { id: true } });
  if (!room) return null;

  const memberIds = (await db.membership.findMany({ where: { classroomId }, select: { userId: true } })).map((m) => m.userId);
  if (memberIds.length < MIN_COHORT) return { members: memberIds.length, hidden: true };

  const [iq, completions, runs] = await Promise.all([
    db.user.aggregate({ where: { id: { in: memberIds } }, _avg: { financialIq: true } }),
    db.courseCompletion.findMany({ where: { userId: { in: memberIds } }, select: { userId: true, courseSlug: true, quizPct: true } }),
    db.gameRun.findMany({ where: { userId: { in: memberIds } }, select: { userId: true, gameSlug: true, iq: true, pct: true } }),
  ]);

  // topic -> learner -> scores (quiz results, and each learner's best result per game)
  const byTopic = new Map<TopicSlug, Map<string, number[]>>();
  const add = (topic: TopicSlug, userId: string, score: number) => {
    const users = byTopic.get(topic) ?? new Map<string, number[]>();
    users.set(userId, [...(users.get(userId) ?? []), score]);
    byTopic.set(topic, users);
  };
  for (const c of completions) {
    const course = getCourse(c.courseSlug);
    if (course) add(course.topic, c.userId, c.quizPct);
  }
  const best = new Map<string, { userId: string; slug: string; score: number }>();
  for (const r of runs) {
    const game = GAMES.find((g) => g.slug === r.gameSlug);
    if (!game) continue;
    const score = game.kind === "fraud" ? r.pct : r.iq;
    const key = `${r.userId}:${r.gameSlug}`;
    if (!best.has(key) || best.get(key)!.score < score) best.set(key, { userId: r.userId, slug: r.gameSlug, score });
  }
  for (const b of best.values()) add(GAMES.find((g) => g.slug === b.slug)!.topic, b.userId, b.score);

  const topics = [...byTopic.entries()]
    .filter(([, users]) => users.size >= MIN_COHORT)
    .map(([slug, users]) => ({
      slug,
      name: TOPICS[slug],
      pct: Math.round(clamp01(mean([...users.values()].map(mean)))),
    }))
    .sort((a, b) => b.pct - a.pct);

  return {
    members: memberIds.length,
    hidden: false,
    avgIq: Math.round(iq._avg.financialIq ?? 0),
    coursesCompleted: completions.length,
    gameRuns: runs.length,
    topics,
  };
}

const clamp01 = (n: number) => Math.min(100, Math.max(0, n));

export type LeaderboardRow = { rank: number; displayName: string; xp: number; level: number };

/** Top learners by XP. Shows display names only, never emails. Teachers and adults are not ranked. */
export async function leaderboard(limit = 20): Promise<LeaderboardRow[]> {
  const rows = await db.user.findMany({
    where: { role: "STUDENT", xp: { gt: 0 } },
    orderBy: [{ xp: "desc" }, { createdAt: "asc" }],
    take: limit,
    select: { displayName: true, xp: true },
  });
  return rows.map((r, i) => ({ rank: i + 1, displayName: r.displayName, xp: r.xp, level: levelFromXp(r.xp).level }));
}
