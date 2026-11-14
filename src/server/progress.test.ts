import { beforeEach, describe, expect, it } from "vitest";
import { getCourse } from "@/lib/courses/catalog";
import { db } from "@/lib/db";
import { InvalidPicksError, NotReadyError } from "@/lib/errors";
import { getFraudDeck, getScenario, getVoyage } from "@/lib/games/catalog";
import { estimateIndividualActivity } from "@/lib/games/tax-rules";
import { DEFAULT_PICK, replayVoyage, type MonthPick } from "@/lib/games/voyage-engine";
import { goalBonusXp, goalsFor } from "@/lib/games/voyage-goals";
import { VOYAGE_YEARS } from "@/lib/games/voyage-years";
import { vilniusDateKey } from "@/lib/progress/streak";
import { resetDb } from "@/test/db";
import { makeUser } from "@/test/factories";
import {
  LESSON_XP,
  bestVoyageRun,
  completeLesson,
  saveCushionPlan,
  submitGameRun,
  submitQuiz,
  touchStreak,
} from "./progress";

beforeEach(resetDb);

const course = getCourse("pensijos-ii-iii-pakopa")!; // has a certificate
const plainCourse = getCourse("pagalve")!; // no certificate
const budget = getScenario("biudzeto-detektyvas")!;
const labyrinth = getScenario("mokesciu-labirintas")!;
const fraud = getFraudDeck("sukciu-medziokle")!;

const goodPicks = (s: typeof budget) =>
  s.steps.map((step) => {
    if (step.type === "choice") return step.choices.findIndex((c) => c.tone === "good");
    return estimateIndividualActivity(step.incomeEur)[step.quantity];
  });
const badPicks = (s: typeof budget) =>
  s.steps.map((step) => (step.type === "choice" ? step.choices.findIndex((c) => c.tone === "bad") : 1));
const rightAnswers = (c: typeof course) => c.quiz.map((q) => q.correct);
const wrongAnswers = (c: typeof course) => c.quiz.map((q) => (q.correct + 1) % q.options.length);

async function readAllLessons(userId: string, c: typeof course) {
  for (const l of c.lessons) await completeLesson(userId, c.slug, l.slug);
}

describe("completeLesson", () => {
  it("gives XP for a lesson and the first-step badge", async () => {
    const u = await makeUser();
    const r = await completeLesson(u.id, course.slug, course.lessons[0].slug);
    expect(r.xpGained).toBe(LESSON_XP);
    expect(r.newBadges).toContain("pirmas-zingsnis");
    expect((await db.user.findUniqueOrThrow({ where: { id: u.id } })).xp).toBe(LESSON_XP);
  });
  it("gives nothing the second time (no XP farming)", async () => {
    const u = await makeUser();
    await completeLesson(u.id, course.slug, course.lessons[0].slug);
    const again = await completeLesson(u.id, course.slug, course.lessons[0].slug);
    expect(again.xpGained).toBe(0);
    expect(again.newBadges).toEqual([]);
    expect((await db.user.findUniqueOrThrow({ where: { id: u.id } })).xp).toBe(LESSON_XP);
    expect(await db.lessonProgress.count({ where: { userId: u.id } })).toBe(1);
  });
  it("is safe when two requests arrive at once", async () => {
    const u = await makeUser();
    await Promise.all([1, 2, 3, 4].map(() => completeLesson(u.id, course.slug, course.lessons[0].slug)));
    expect((await db.user.findUniqueOrThrow({ where: { id: u.id } })).xp).toBe(LESSON_XP);
  });
  it("rejects an unknown course or lesson", async () => {
    const u = await makeUser();
    await expect(completeLesson(u.id, "nera", "nera")).rejects.toBeInstanceOf(InvalidPicksError);
    await expect(completeLesson(u.id, course.slug, "nera")).rejects.toBeInstanceOf(InvalidPicksError);
    expect(await db.lessonProgress.count()).toBe(0);
  });
});

describe("submitQuiz", () => {
  it("requires every lesson to be read first", async () => {
    const u = await makeUser();
    await completeLesson(u.id, course.slug, course.lessons[0].slug);
    await expect(submitQuiz(u.id, course.slug, rightAnswers(course))).rejects.toBeInstanceOf(NotReadyError);
    expect(await db.courseCompletion.count()).toBe(0);
  });
  it("on the first pass gives course XP, an IQ gain, a completion and a certificate", async () => {
    const u = await makeUser();
    await readAllLessons(u.id, course);
    const before = await db.user.findUniqueOrThrow({ where: { id: u.id } });
    const r = await submitQuiz(u.id, course.slug, rightAnswers(course));
    expect(r.quiz.passed).toBe(true);
    expect(r.xpGained).toBe(course.xp);
    expect(r.iqGained).toBe(10);
    expect(r.certificateId).toMatch(/^TS-/);
    expect(r.newBadges).toContain("kurso-baigimas");
    const after = await db.user.findUniqueOrThrow({ where: { id: u.id } });
    expect(after.xp).toBe(before.xp + course.xp);
    expect(after.financialIq).toBe(before.financialIq + 10);
    expect(await db.certificate.count({ where: { userId: u.id } })).toBe(1);
  });
  it("gives no certificate for a course that does not offer one", async () => {
    const u = await makeUser();
    await readAllLessons(u.id, plainCourse);
    const r = await submitQuiz(u.id, plainCourse.slug, rightAnswers(plainCourse));
    expect(r.quiz.passed).toBe(true);
    expect(r.certificateId).toBeNull();
    expect(await db.certificate.count()).toBe(0);
  });
  it("a failed attempt gives nothing and can be retried", async () => {
    const u = await makeUser();
    await readAllLessons(u.id, course);
    const xpBefore = (await db.user.findUniqueOrThrow({ where: { id: u.id } })).xp;
    const fail = await submitQuiz(u.id, course.slug, wrongAnswers(course));
    expect(fail.quiz.passed).toBe(false);
    expect(fail.xpGained).toBe(0);
    expect(fail.certificateId).toBeNull();
    expect((await db.user.findUniqueOrThrow({ where: { id: u.id } })).xp).toBe(xpBefore);
    const pass = await submitQuiz(u.id, course.slug, rightAnswers(course));
    expect(pass.xpGained).toBe(course.xp);
  });
  it("a second pass gives 0 XP and returns the same certificate (no farming)", async () => {
    const u = await makeUser();
    await readAllLessons(u.id, course);
    const first = await submitQuiz(u.id, course.slug, rightAnswers(course));
    const xpAfterFirst = (await db.user.findUniqueOrThrow({ where: { id: u.id } })).xp;
    const second = await submitQuiz(u.id, course.slug, rightAnswers(course));
    expect(second.xpGained).toBe(0);
    expect(second.iqGained).toBe(0);
    expect(second.certificateId).toBe(first.certificateId);
    expect((await db.user.findUniqueOrThrow({ where: { id: u.id } })).xp).toBe(xpAfterFirst);
    expect(await db.certificate.count()).toBe(1);
  });
  it("simultaneous passing submissions still pay out once", async () => {
    const u = await makeUser();
    await readAllLessons(u.id, course);
    const xpBefore = (await db.user.findUniqueOrThrow({ where: { id: u.id } })).xp;
    await Promise.all([1, 2, 3].map(() => submitQuiz(u.id, course.slug, rightAnswers(course))));
    expect((await db.user.findUniqueOrThrow({ where: { id: u.id } })).xp).toBe(xpBefore + course.xp);
    expect(await db.certificate.count()).toBe(1);
  });
  it("rejects tampered answers and stores nothing", async () => {
    const u = await makeUser();
    await readAllLessons(u.id, course);
    await expect(submitQuiz(u.id, course.slug, [99, 99, 99, 99, 99])).rejects.toBeInstanceOf(InvalidPicksError);
    await expect(submitQuiz(u.id, course.slug, [0])).rejects.toBeInstanceOf(InvalidPicksError);
    await expect(submitQuiz(u.id, "nera", [0])).rejects.toBeInstanceOf(InvalidPicksError);
    expect(await db.courseCompletion.count()).toBe(0);
  });
});

describe("submitGameRun: scenarios", () => {
  it("stores a run computed from the picks, not from anything the client claims", async () => {
    const u = await makeUser();
    const r = await submitGameRun(u.id, budget.slug, goodPicks(budget));
    const run = await db.gameRun.findFirstOrThrow({ where: { userId: u.id } });
    expect(run.gameSlug).toBe(budget.slug);
    expect(run.iq).toBeGreaterThanOrEqual(90);
    expect(r.xpGained).toBeGreaterThan(0);
    expect(r.newBadges).toContain("budrus-detektyvas");
  });
  it("rejects out-of-range picks and stores nothing", async () => {
    const u = await makeUser();
    const picks = goodPicks(budget);
    picks[0] = 99;
    await expect(submitGameRun(u.id, budget.slug, picks)).rejects.toBeInstanceOf(InvalidPicksError);
    await expect(submitGameRun(u.id, budget.slug, [0])).rejects.toBeInstanceOf(InvalidPicksError);
    await expect(submitGameRun(u.id, budget.slug, "juokas")).rejects.toBeInstanceOf(InvalidPicksError);
    await expect(submitGameRun(u.id, "nera-tokio-zaidimo", [])).rejects.toBeInstanceOf(InvalidPicksError);
    expect(await db.gameRun.count()).toBe(0);
    expect((await db.user.findUniqueOrThrow({ where: { id: u.id } })).xp).toBe(0);
  });
  it("a bad run earns less XP and less IQ than a good one", async () => {
    const a = await makeUser();
    const b = await makeUser();
    const good = await submitGameRun(a.id, budget.slug, goodPicks(budget));
    const bad = await submitGameRun(b.id, budget.slug, badPicks(budget));
    expect(good.xpGained).toBeGreaterThan(bad.xpGained);
    expect(good.iqGained).toBeGreaterThan(bad.iqGained);
    expect(bad.iqGained).toBeGreaterThanOrEqual(0);
  });
  it("caps the Finansinis IQ at 100 however many times it is played", async () => {
    const u = await makeUser();
    for (let i = 0; i < 12; i++) await submitGameRun(u.id, budget.slug, goodPicks(budget));
    expect((await db.user.findUniqueOrThrow({ where: { id: u.id } })).financialIq).toBeLessThanOrEqual(100);
  });
  it("awards the tax badge for finishing the labyrinth", async () => {
    const u = await makeUser();
    const r = await submitGameRun(u.id, labyrinth.slug, goodPicks(labyrinth));
    expect(r.newBadges).toContain("mokesciu-keliautojas");
  });
  it("does not award a badge twice", async () => {
    const u = await makeUser();
    await submitGameRun(u.id, budget.slug, goodPicks(budget));
    const again = await submitGameRun(u.id, budget.slug, goodPicks(budget));
    expect(again.newBadges).toEqual([]);
    expect(await db.badgeAward.count({ where: { userId: u.id, badgeSlug: "budrus-detektyvas" } })).toBe(1);
  });
});

describe("submitGameRun: fraud spotter", () => {
  const perfect = () =>
    fraud.items.map((i) => ({
      itemId: i.id,
      verdict: i.isScam ? "scam" : "safe",
      flagIds: i.flags.map((f) => f.id),
      ms: 2000,
    }));

  it("scores on the server and awards the fraud badge for a strong run", async () => {
    const u = await makeUser();
    const r = await submitGameRun(u.id, fraud.slug, perfect());
    const run = await db.gameRun.findFirstOrThrow({ where: { userId: u.id } });
    expect(run.pct).toBe(100);
    expect(run.points).toBeGreaterThan(1000);
    expect(r.newBadges).toContain("sukciu-medziotojas");
    expect(r.iqGained).toBeGreaterThan(0);
  });
  it("rejects tampered answers", async () => {
    const u = await makeUser();
    const answers = perfect();
    answers.push({ ...answers[0] });
    await expect(submitGameRun(u.id, fraud.slug, answers)).rejects.toBeInstanceOf(InvalidPicksError);
    await expect(submitGameRun(u.id, fraud.slug, { points: 99999 })).rejects.toBeInstanceOf(InvalidPicksError);
    expect(await db.gameRun.count()).toBe(0);
  });
});

describe("saveCushionPlan", () => {
  it("stores the plan and awards the badge for 3+ months", async () => {
    const u = await makeUser("ADULT");
    const r = await saveCushionPlan(u.id, { monthlyExpenses: 900, currentSavings: 0, monthlySaving: 300, targetMonths: 3 });
    expect(r.newBadges).toContain("pagalves-architektas");
    expect(await db.cushionPlan.count({ where: { userId: u.id } })).toBe(1);
  });
  it("replaces the old plan instead of adding another", async () => {
    const u = await makeUser("ADULT");
    await saveCushionPlan(u.id, { monthlyExpenses: 900, currentSavings: 0, monthlySaving: 300, targetMonths: 3 });
    await saveCushionPlan(u.id, { monthlyExpenses: 1000, currentSavings: 0, monthlySaving: 200, targetMonths: 6 });
    expect(await db.cushionPlan.count({ where: { userId: u.id } })).toBe(1);
    expect((await db.cushionPlan.findUniqueOrThrow({ where: { userId: u.id } })).monthlyExpenses).toBe(1000);
  });
  it("gives no badge for a plan under 3 months", async () => {
    const u = await makeUser("ADULT");
    const r = await saveCushionPlan(u.id, { monthlyExpenses: 900, currentSavings: 0, monthlySaving: 300, targetMonths: 2 });
    expect(r.newBadges).not.toContain("pagalves-architektas");
  });
  it("rejects nonsense numbers", async () => {
    const u = await makeUser("ADULT");
    for (const bad of [
      { monthlyExpenses: -5, currentSavings: 0, monthlySaving: 100, targetMonths: 3 },
      { monthlyExpenses: 900, currentSavings: 0, monthlySaving: 100, targetMonths: 0 },
      { monthlyExpenses: Number.NaN, currentSavings: 0, monthlySaving: 100, targetMonths: 3 },
      { monthlyExpenses: 900, currentSavings: 0, monthlySaving: 100, targetMonths: 3.5 },
      { monthlyExpenses: 99999999999, currentSavings: 0, monthlySaving: 100, targetMonths: 3 },
    ]) {
      await expect(saveCushionPlan(u.id, bad)).rejects.toBeInstanceOf(InvalidPicksError);
    }
    expect(await db.cushionPlan.count()).toBe(0);
  });
});

describe("touchStreak", () => {
  it("starts a streak at 1 and keeps it when called again the same day", async () => {
    const u = await makeUser();
    await touchStreak(u.id);
    await touchStreak(u.id);
    const row = await db.user.findUniqueOrThrow({ where: { id: u.id } });
    expect(row.streakCount).toBe(1);
    expect(row.lastActiveKey).toBe(vilniusDateKey(new Date()));
  });
  it("continues the streak when the last active day was yesterday", async () => {
    const u = await makeUser();
    const yesterday = vilniusDateKey(new Date(Date.now() - 86_400_000));
    await db.user.update({ where: { id: u.id }, data: { streakCount: 4, longestStreak: 4, lastActiveKey: yesterday } });
    await touchStreak(u.id);
    const row = await db.user.findUniqueOrThrow({ where: { id: u.id } });
    expect(row.streakCount).toBe(5);
    expect(row.longestStreak).toBe(5);
  });
  it("resets to 1 after a missed day but remembers the longest streak", async () => {
    const u = await makeUser();
    const old = vilniusDateKey(new Date(Date.now() - 3 * 86_400_000));
    await db.user.update({ where: { id: u.id }, data: { streakCount: 9, longestStreak: 9, lastActiveKey: old } });
    await touchStreak(u.id);
    const row = await db.user.findUniqueOrThrow({ where: { id: u.id } });
    expect(row.streakCount).toBe(1);
    expect(row.longestStreak).toBe(9);
  });
  it("simultaneous calls on the same day count the day once", async () => {
    const u = await makeUser();
    await Promise.all([1, 2, 3, 4].map(() => touchStreak(u.id)));
    expect((await db.user.findUniqueOrThrow({ where: { id: u.id } })).streakCount).toBe(1);
  });
  it("ignores an unknown user", async () => {
    await expect(touchStreak("nera-tokio")).resolves.toBeUndefined();
  });
});

describe("submitGameRun: Kuršių marių kapitonas (voyage)", () => {
  const voyage = getVoyage("kursiu-mariu-kapitonas")!;
  const year = (f: (m: number) => Partial<MonthPick>): MonthPick[] =>
    Array.from({ length: 12 }, (_, i) => ({ ...DEFAULT_PICK, ...f(i + 1) }));
  const prudent = () =>
    year((m) => ({ toTax: m <= 9 ? 0.25 : 0.1, toCushion: [5, 6, 7, 8].includes(m) ? 0.4 : 0.1, resistScam: true }));
  const careless = () => year(() => ({ resistScam: false, takeLoan: true }));

  it("replays the year on the server and stores the engine's score and net worth", async () => {
    const u = await makeUser();
    const r = await submitGameRun(u.id, voyage.slug, prudent());
    const expected = replayVoyage(voyage, prudent());
    const run = await db.gameRun.findFirstOrThrow({ where: { userId: u.id } });
    expect(run.gameSlug).toBe(voyage.slug);
    expect(run.iq).toBe(expected.score.iq);
    expect(run.eur).toBe(Math.round(expected.netWorth));
    expect(r.newBadges).toContain("ziemos-kapitonas");
  });
  it("a careless year earns less XP and less IQ than a prudent one, and no badge", async () => {
    const a = await makeUser();
    const b = await makeUser();
    const good = await submitGameRun(a.id, voyage.slug, prudent());
    const bad = await submitGameRun(b.id, voyage.slug, careless());
    expect(good.xpGained).toBeGreaterThan(bad.xpGained);
    expect(good.iqGained).toBeGreaterThan(bad.iqGained);
    expect(bad.iqGained).toBeGreaterThanOrEqual(0);
    expect(bad.newBadges).not.toContain("ziemos-kapitonas");
  });
  it("ignores a score the client claims: extra fields are dropped and the stored score is recomputed", async () => {
    const u = await makeUser();
    const forged = careless().map((p) => ({ ...p, iq: 100, cash: 999999, score: { iq: 100 } }));
    await submitGameRun(u.id, voyage.slug, forged);
    const run = await db.gameRun.findFirstOrThrow({ where: { userId: u.id } });
    expect(run.iq).toBe(replayVoyage(voyage, careless()).score.iq);
    expect(run.iq).toBeLessThan(50);
  });
  it("rejects tampered or malformed input and stores nothing", async () => {
    const u = await makeUser();
    const bad: unknown[] = [
      prudent().slice(1),
      [...prudent(), DEFAULT_PICK],
      prudent().map((p, i) => (i === 3 ? { ...p, toTax: 2 } : p)),
      prudent().map((p, i) => (i === 3 ? { ...p, toCushion: -0.5 } : p)),
      prudent().map((p, i) => (i === 3 ? { ...p, takeLoan: "yes" } : p)),
      "juokas",
      null,
      { points: 99999 },
    ];
    for (const picks of bad) await expect(submitGameRun(u.id, voyage.slug, picks)).rejects.toBeInstanceOf(InvalidPicksError);
    expect(await db.gameRun.count()).toBe(0);
    expect((await db.user.findUniqueOrThrow({ where: { id: u.id } })).xp).toBe(0);
  });
  it("stores a year that uses the term deposit exactly as the engine computes it", async () => {
    const u = await makeUser();
    const withDeposit = () => year((m) => ({ toTax: m <= 9 ? 0.25 : 0.1, toCushion: [5, 6, 7, 8].includes(m) ? 0.3 : 0.1, resistScam: true, deposit: m === 5 || m === 6 ? 0.2 : 0 }));
    const expected = replayVoyage(voyage, withDeposit());
    expect(expected.totals.depositedAmount).toBeGreaterThan(0); // the premise: this year really locks money
    await submitGameRun(u.id, voyage.slug, withDeposit());
    const run = await db.gameRun.findFirstOrThrow({ where: { userId: u.id } });
    expect(run.iq).toBe(expected.score.iq);
    expect(run.eur).toBe(Math.round(expected.netWorth));
  });
  it("stores a year that sells at other ports exactly as the engine computes it", async () => {
    const u = await makeUser();
    const travelling = () => year((m) => ({ toTax: m <= 9 ? 0.25 : 0.1, toCushion: [5, 6, 7, 8].includes(m) ? 0.4 : 0.1, resistScam: true, market: m === 4 || m === 5 ? "klaipeda" : m >= 6 && m <= 8 ? "juodkrante" : undefined }));
    const expected = replayVoyage(voyage, travelling());
    expect(expected.totals.travelCosts).toBeGreaterThan(0); // the premise: this year really travels
    await submitGameRun(u.id, voyage.slug, travelling());
    const run = await db.gameRun.findFirstOrThrow({ where: { userId: u.id } });
    expect(run.iq).toBe(expected.score.iq);
    expect(run.eur).toBe(Math.round(expected.netWorth));
  });
  it("rejects a forged market and stores nothing", async () => {
    const u = await makeUser();
    for (const forged of ["tokio", 7, "", null, ["nida"], "KLAIPEDA"]) {
      await expect(submitGameRun(u.id, voyage.slug, prudent().map((p, i) => (i === 5 ? { ...p, market: forged } : p)))).rejects.toBeInstanceOf(InvalidPicksError);
    }
    expect(await db.gameRun.count()).toBe(0);
  });
  it("rejects a forged deposit and stores nothing", async () => {
    const u = await makeUser();
    for (const forged of [5, -1, "0.5", null, Number.POSITIVE_INFINITY]) {
      await expect(submitGameRun(u.id, voyage.slug, prudent().map((p, i) => (i === 5 ? { ...p, deposit: forged } : p)))).rejects.toBeInstanceOf(InvalidPicksError);
    }
    expect(await db.gameRun.count()).toBe(0);
  });
  it("still accepts picks from a client that predates the deposit (the field is missing)", async () => {
    const u = await makeUser();
    const old = prudent().map((p) => {
      const copy: Partial<MonthPick> = { ...p };
      delete copy.deposit;
      return copy;
    });
    await submitGameRun(u.id, voyage.slug, old);
    const run = await db.gameRun.findFirstOrThrow({ where: { userId: u.id } });
    expect(run.iq).toBe(replayVoyage(voyage, prudent()).score.iq);
  });
  it("a good result in the hard year earns the winter-captain badge too", async () => {
    const hard = getVoyage("kursiu-mariu-kapitonas-sunkus-metai")!;
    const u = await makeUser();
    const careful = year((m) => ({ toTax: m <= 9 ? 0.25 : 0.1, toCushion: [5, 6, 7, 8, 9].includes(m) ? 0.5 : 0.15, resistScam: true }));
    const r = await submitGameRun(u.id, hard.slug, careful);
    const expected = replayVoyage(hard, careful);
    expect(expected.score.iq).toBeGreaterThanOrEqual(75);
    expect(r.newBadges).toContain("ziemos-kapitonas");
    const run = await db.gameRun.findFirstOrThrow({ where: { userId: u.id } });
    expect(run.gameSlug).toBe(hard.slug);
    expect(run.iq).toBe(expected.score.iq);
  });
  it("the badge uses the best result across both years, whichever was played first", async () => {
    const hard = getVoyage("kursiu-mariu-kapitonas-sunkus-metai")!;
    const u = await makeUser();
    const poor = year(() => ({ resistScam: false, takeLoan: true }));
    await submitGameRun(u.id, voyage.slug, poor);
    const r = await submitGameRun(u.id, hard.slug, year((m) => ({ toTax: m <= 9 ? 0.25 : 0.1, toCushion: [5, 6, 7, 8, 9].includes(m) ? 0.5 : 0.15, resistScam: true })));
    expect(r.newBadges).toContain("ziemos-kapitonas");
  });
  it("pays a small bonus for goals met, computed by the server from the replay", async () => {
    const a = await makeUser();
    const b = await makeUser();
    const good = await submitGameRun(a.id, voyage.slug, prudent());
    const bad = await submitGameRun(b.id, voyage.slug, careless());
    const goalsGood = goalsFor(voyage, replayVoyage(voyage, prudent())).filter((g) => g.met).length;
    expect(goalsGood).toBeGreaterThan(0);
    expect(good.xpGained).toBeGreaterThan(bad.xpGained);
    // the bonus is exactly what the pure function says, on top of the base reward
    const withoutBonus = 20 + Math.round(replayVoyage(voyage, prudent()).score.iq / 2);
    expect(good.xpGained).toBe(withoutBonus + goalBonusXp(goalsFor(voyage, replayVoyage(voyage, prudent()))));
  });
  it("a forged goals list in the payload earns nothing extra", async () => {
    const a = await makeUser();
    const b = await makeUser();
    const forged = careless().map((p) => ({ ...p, goals: ["x", "y"], goalsMet: 6, bonusXp: 9999 }));
    const plain = await submitGameRun(a.id, voyage.slug, careless());
    const fake = await submitGameRun(b.id, voyage.slug, forged);
    expect(fake.xpGained).toBe(plain.xpGained);
  });
  it("returns the goals and the personal best with the result", async () => {
    const u = await makeUser();
    const first = await submitGameRun(u.id, voyage.slug, careless());
    const second = await submitGameRun(u.id, voyage.slug, prudent());
    expect(second.summary).toHaveProperty("score");
    const best = await bestVoyageRun(u.id, voyage.slug);
    expect(best).not.toBeNull();
    expect(best!.iq).toBe(Math.max(replayVoyage(voyage, careless()).score.iq, replayVoyage(voyage, prudent()).score.iq));
    expect(first.xpGained).toBeGreaterThanOrEqual(0);
  });
  it("has no personal best before the first run, and keeps the best for each year separately", async () => {
    const u = await makeUser();
    expect(await bestVoyageRun(u.id, voyage.slug)).toBeNull();
    await submitGameRun(u.id, voyage.slug, prudent());
    expect(await bestVoyageRun(u.id, "kursiu-mariu-kapitonas-sunkus-metai")).toBeNull();
    expect(await bestVoyageRun(u.id, voyage.slug)).not.toBeNull();
  });
  it("every year of the voyage can be saved, replayed by the server, and counted for the badge", async () => {
    for (const slug of VOYAGE_YEARS.map((y) => y.slug)) {
      const y = getVoyage(slug)!;
      const u = await makeUser();
      const careful = year((m) => ({ toTax: m <= 9 ? 0.25 : 0.1, toCushion: [4, 5, 6, 7, 8, 9].includes(m) ? 0.5 : 0.15, resistScam: true, insure: Boolean(y.events[y.months[m - 1].event].cost && !y.events[y.months[m - 1].event].scam) }));
      const r = await submitGameRun(u.id, slug, careful);
      const expected = replayVoyage(y, careful);
      const run = await db.gameRun.findFirstOrThrow({ where: { userId: u.id } });
      expect(run.gameSlug, slug).toBe(slug);
      expect(run.iq, slug).toBe(expected.score.iq);
      expect(run.eur, slug).toBe(Math.round(expected.netWorth));
      if (expected.score.iq >= 75) expect(r.newBadges, slug).toContain("ziemos-kapitonas");
    }
  });
  it("the best result is kept separately for each of the four years", async () => {
    const u = await makeUser();
    const [gentle, , , stormy] = VOYAGE_YEARS.map((y) => y.slug);
    await submitGameRun(u.id, gentle, year(() => ({ toTax: 0.25, toCushion: 0.3, resistScam: true })));
    expect(await bestVoyageRun(u.id, gentle)).not.toBeNull();
    expect(await bestVoyageRun(u.id, stormy)).toBeNull();
  });
  it("replaying the same year many times never pushes the IQ above 100", async () => {
    const u = await makeUser();
    for (let i = 0; i < 12; i++) await submitGameRun(u.id, voyage.slug, prudent());
    expect((await db.user.findUniqueOrThrow({ where: { id: u.id } })).financialIq).toBeLessThanOrEqual(100);
  });
});
