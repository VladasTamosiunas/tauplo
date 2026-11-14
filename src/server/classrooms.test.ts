import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { resetDb } from "@/test/db";
import { makeUser } from "@/test/factories";
import { MIN_COHORT, classroomStats, createClassroom, joinClassroom, leaderboard, listClassrooms } from "./classrooms";

beforeEach(resetDb);

async function classWith(n: number) {
  const teacher = await makeUser("TEACHER");
  const room = await createClassroom(teacher.id, { name: "10B klasė", kind: "CLASS" });
  const students = [];
  for (let i = 0; i < n; i++) {
    const s = await makeUser("STUDENT", { displayName: `Slaptas Vardas ${i}` });
    const r = await joinClassroom(s.id, room.joinCode);
    expect(r.ok).toBe(true);
    students.push(s);
  }
  return { teacher, room, students };
}

describe("createClassroom", () => {
  it("creates a room with a TK- join code owned by the teacher", async () => {
    const teacher = await makeUser("TEACHER");
    const room = await createClassroom(teacher.id, { name: "  9A klasė  ", kind: "CLASS" });
    expect(room.joinCode).toMatch(/^TK-[A-Z2-9]{4}$/);
    expect(room.name).toBe("9A klasė");
    expect(room.ownerId).toBe(teacher.id);
  });
  it("gives every room a different code", async () => {
    const teacher = await makeUser("TEACHER");
    const rooms = await Promise.all(
      Array.from({ length: 10 }, (_, i) => createClassroom(teacher.id, { name: `Klasė ${i}`, kind: "CAMPAIGN" })),
    );
    expect(new Set(rooms.map((r) => r.joinCode)).size).toBe(10);
  });
  it("only teachers can create rooms", async () => {
    const student = await makeUser("STUDENT");
    await expect(createClassroom(student.id, { name: "Mano klasė", kind: "CLASS" })).rejects.toThrow();
    expect(await db.classroom.count()).toBe(0);
  });
  it("rejects an empty or very long name", async () => {
    const teacher = await makeUser("TEACHER");
    await expect(createClassroom(teacher.id, { name: "  ", kind: "CLASS" })).rejects.toThrow();
    await expect(createClassroom(teacher.id, { name: "x".repeat(81), kind: "CLASS" })).rejects.toThrow();
  });
});

describe("joinClassroom", () => {
  it("joins with the code in any case, with or without prefix", async () => {
    const teacher = await makeUser("TEACHER");
    const room = await createClassroom(teacher.id, { name: "11A", kind: "CLASS" });
    const s = await makeUser("STUDENT");
    const r = await joinClassroom(s.id, room.joinCode.toLowerCase());
    expect(r).toEqual({ ok: true, classroomName: "11A" });
    const s2 = await makeUser("ADULT");
    expect((await joinClassroom(s2.id, room.joinCode.slice(3))).ok).toBe(true);
  });
  it("joining twice is still one membership", async () => {
    const { room, students } = await classWith(1);
    await joinClassroom(students[0].id, room.joinCode);
    await joinClassroom(students[0].id, room.joinCode);
    expect(await db.membership.count({ where: { classroomId: room.id } })).toBe(1);
  });
  it("simultaneous joins make one membership", async () => {
    const teacher = await makeUser("TEACHER");
    const room = await createClassroom(teacher.id, { name: "11A", kind: "CLASS" });
    const s = await makeUser("STUDENT");
    await Promise.all([1, 2, 3].map(() => joinClassroom(s.id, room.joinCode)));
    expect(await db.membership.count()).toBe(1);
  });
  it("fails clearly for an unknown or empty code", async () => {
    const s = await makeUser("STUDENT");
    const unknown = await joinClassroom(s.id, "TK-ZZZZ");
    expect(unknown.ok).toBe(false);
    if (!unknown.ok) expect(unknown.error).toBeTruthy();
    expect((await joinClassroom(s.id, "   ")).ok).toBe(false);
    expect(await db.membership.count()).toBe(0);
  });
  it("teachers cannot join a room as a learner", async () => {
    const { room } = await classWith(0);
    const other = await makeUser("TEACHER");
    const r = await joinClassroom(other.id, room.joinCode);
    expect(r.ok).toBe(false);
    expect(await db.membership.count()).toBe(0);
  });
});

describe("classroomStats: anonymity", () => {
  it("hides all numbers when fewer than the minimum cohort have joined", async () => {
    expect(MIN_COHORT).toBe(3);
    for (const n of [0, 1, 2]) {
      await resetDb();
      const { room, teacher, students } = await classWith(n);
      for (const s of students) await db.user.update({ where: { id: s.id }, data: { financialIq: 77 } });
      const stats = await classroomStats(room.id, teacher.id);
      expect(stats).toEqual({ members: n, hidden: true });
    }
  });
  it("shows aggregates at the minimum cohort", async () => {
    const { room, teacher, students } = await classWith(3);
    const iqs = [60, 70, 80];
    for (const [i, s] of students.entries()) await db.user.update({ where: { id: s.id }, data: { financialIq: iqs[i] } });
    const stats = await classroomStats(room.id, teacher.id);
    expect(stats).toMatchObject({ members: 3, hidden: false, avgIq: 70 });
  });
  it("never contains names, emails or ids of learners", async () => {
    const { room, teacher, students } = await classWith(4);
    await db.gameRun.create({ data: { userId: students[0].id, gameSlug: "biudzeto-detektyvas", iq: 80 } });
    const json = JSON.stringify(await classroomStats(room.id, teacher.id));
    for (const s of students) {
      expect(json).not.toContain(s.displayName);
      expect(json).not.toContain(s.email);
      expect(json).not.toContain(s.id);
    }
  });
  it("counts completed courses and game runs by members only", async () => {
    const { room, teacher, students } = await classWith(3);
    const outsider = await makeUser("STUDENT");
    await db.courseCompletion.create({ data: { userId: students[0].id, courseSlug: "pagalve", quizPct: 100 } });
    await db.courseCompletion.create({ data: { userId: outsider.id, courseSlug: "pagalve", quizPct: 100 } });
    await db.gameRun.create({ data: { userId: students[1].id, gameSlug: "biudzeto-detektyvas", iq: 70 } });
    await db.gameRun.create({ data: { userId: outsider.id, gameSlug: "biudzeto-detektyvas", iq: 70 } });
    const stats = await classroomStats(room.id, teacher.id);
    expect(stats).toMatchObject({ coursesCompleted: 1, gameRuns: 1 });
  });
  it("reports topic mastery as percentages between 0 and 100", async () => {
    const { room, teacher, students } = await classWith(3);
    const scores = [100, 50, 75];
    for (const [i, s] of students.entries()) {
      await db.courseCompletion.create({ data: { userId: s.id, courseSlug: "pagalve", quizPct: scores[i] } });
    }
    const stats = await classroomStats(room.id, teacher.id);
    if (!stats || stats.hidden) throw new Error("expected visible stats");
    const taupymas = stats.topics.find((t) => t.slug === "taupymas");
    expect(taupymas?.pct).toBe(75);
    for (const t of stats.topics) {
      expect(t.pct).toBeGreaterThanOrEqual(0);
      expect(t.pct).toBeLessThanOrEqual(100);
    }
  });
  it("leaves out a topic that fewer than 3 learners contributed to (it would expose them)", async () => {
    const { room, teacher, students } = await classWith(4);
    await db.courseCompletion.create({ data: { userId: students[0].id, courseSlug: "pagalve", quizPct: 100 } });
    await db.courseCompletion.create({ data: { userId: students[1].id, courseSlug: "pagalve", quizPct: 40 } });
    const stats = await classroomStats(room.id, teacher.id);
    if (!stats || stats.hidden) throw new Error("expected visible stats");
    expect(stats.topics.find((t) => t.slug === "taupymas")).toBeUndefined();
  });
  it("uses each learner's best game result for a topic, once per learner", async () => {
    const { room, teacher, students } = await classWith(3);
    for (const s of students) {
      await db.gameRun.create({ data: { userId: s.id, gameSlug: "sukciu-medziokle", pct: 20 } });
      await db.gameRun.create({ data: { userId: s.id, gameSlug: "sukciu-medziokle", pct: 80 } });
    }
    const stats = await classroomStats(room.id, teacher.id);
    if (!stats || stats.hidden) throw new Error("expected visible stats");
    expect(stats.topics.find((t) => t.slug === "sukciai")?.pct).toBe(80);
  });
});

describe("classroomStats: ownership", () => {
  it("returns null for someone who does not own the room", async () => {
    const { room } = await classWith(4);
    const otherTeacher = await makeUser("TEACHER");
    expect(await classroomStats(room.id, otherTeacher.id)).toBeNull();
  });
  it("returns null for a student, even a member", async () => {
    const { room, students } = await classWith(4);
    expect(await classroomStats(room.id, students[0].id)).toBeNull();
  });
  it("returns null for an unknown room", async () => {
    const t = await makeUser("TEACHER");
    expect(await classroomStats("nera-tokios", t.id)).toBeNull();
  });
});

describe("listClassrooms", () => {
  it("lists only the teacher's own rooms with member counts", async () => {
    const { teacher, room } = await classWith(2);
    const other = await makeUser("TEACHER");
    await createClassroom(other.id, { name: "Svetima", kind: "CLASS" });
    const mine = await listClassrooms(teacher.id);
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ id: room.id, members: 2 });
  });
});

describe("leaderboard", () => {
  it("ranks students by XP, shows display names only, and omits teachers", async () => {
    const a = await makeUser("STUDENT", { displayName: "Aistė" });
    const b = await makeUser("STUDENT", { displayName: "Benas" });
    const t = await makeUser("TEACHER", { displayName: "Mokytoja" });
    const adult = await makeUser("ADULT", { displayName: "Suaugęs" });
    await db.user.update({ where: { id: a.id }, data: { xp: 300 } });
    await db.user.update({ where: { id: b.id }, data: { xp: 500 } });
    await db.user.update({ where: { id: t.id }, data: { xp: 9999 } });
    await db.user.update({ where: { id: adult.id }, data: { xp: 9999 } });
    const rows = await leaderboard(20);
    expect(rows.map((r) => r.displayName)).toEqual(["Benas", "Aistė"]);
    expect(rows[0].rank).toBe(1);
    expect(JSON.stringify(rows)).not.toContain("@");
  });
  it("respects the limit and skips learners with no XP", async () => {
    for (let i = 0; i < 5; i++) {
      const u = await makeUser("STUDENT");
      await db.user.update({ where: { id: u.id }, data: { xp: 10 * (i + 1) } });
    }
    await makeUser("STUDENT");
    expect(await leaderboard(3)).toHaveLength(3);
    expect(await leaderboard(20)).toHaveLength(5);
  });
});
