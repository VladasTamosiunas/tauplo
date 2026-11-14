import { describe, expect, it } from "vitest";
import { InvalidPicksError } from "../errors";
import { AUDIENCE_LABEL, LEVEL_LABEL, getCourse, getCourses, scoreQuiz, totalMinutes } from "./catalog";

const courses = getCourses();

describe("course catalog", () => {
  it("has six courses covering all three audiences", () => {
    expect(courses).toHaveLength(6);
    expect(new Set(courses.map((c) => c.audience))).toEqual(new Set(["mokiniai", "suaugusieji", "verslas"]));
  });
  it("slugs are unique and getCourse finds each one", () => {
    expect(new Set(courses.map((c) => c.slug)).size).toBe(courses.length);
    for (const c of courses) expect(getCourse(c.slug)?.slug).toBe(c.slug);
    expect(getCourse("nera-tokio")).toBeUndefined();
  });
  it("has a label for every audience and level in use", () => {
    for (const c of courses) {
      expect(AUDIENCE_LABEL[c.audience]).toBeTruthy();
      expect(LEVEL_LABEL[c.level]).toBeTruthy();
    }
  });
  it("offers a certificate on at least two courses", () => {
    expect(courses.filter((c) => c.certificate).length).toBeGreaterThanOrEqual(2);
  });
  it("totalMinutes adds up the lessons", () => {
    const c = courses[0];
    expect(totalMinutes(c)).toBe(c.lessons.reduce((n, l) => n + l.minutes, 0));
    expect(totalMinutes(c)).toBeGreaterThan(0);
  });
});

describe.each(courses.map((c) => [c.slug, c] as const))("course %s", (_slug, c) => {
  it("has at least 3 lessons with unique slugs", () => {
    expect(c.lessons.length).toBeGreaterThanOrEqual(3);
    expect(new Set(c.lessons.map((l) => l.slug)).size).toBe(c.lessons.length);
  });
  it("has a quiz of at least 3 questions whose correct answer exists", () => {
    expect(c.quiz.length).toBeGreaterThanOrEqual(3);
    for (const q of c.quiz) {
      expect(q.options.length).toBeGreaterThanOrEqual(2);
      expect(q.correct).toBeGreaterThanOrEqual(0);
      expect(q.correct).toBeLessThan(q.options.length);
    }
  });
  it("has no unfilled placeholders and no em-dashes or en-dashes", () => {
    const text = JSON.stringify(c);
    expect(text).not.toMatch(/\{\w+\}/);
    expect(text).not.toMatch(/[–—]/);
  });
  it("uses plain ASCII URL slugs for the course and every lesson", () => {
    const ok = /^[a-z0-9]+(-[a-z0-9]+)*$/;
    expect(c.slug).toMatch(ok);
    for (const l of c.lessons) expect(l.slug).toMatch(ok);
  });
  it("does not always put the right answer first", () => {
    expect(c.quiz.some((q) => q.correct !== 0)).toBe(true);
  });
});

describe("scoreQuiz", () => {
  const c = courses[0];
  const right = c.quiz.map((q) => q.correct);
  const wrong = c.quiz.map((q) => (q.correct + 1) % q.options.length);

  it("all correct is 100% and passed", () => {
    expect(scoreQuiz(c, right)).toEqual({ correct: c.quiz.length, total: c.quiz.length, pct: 100, passed: true });
  });
  it("all wrong is 0% and not passed", () => {
    expect(scoreQuiz(c, wrong)).toMatchObject({ correct: 0, pct: 0, passed: false });
  });
  it("passes exactly at the pass mark and fails just below it", () => {
    // Build answers with k correct and check the boundary around passPct.
    const results = c.quiz.map((_, k) => {
      const answers = c.quiz.map((q, i) => (i < k ? q.correct : (q.correct + 1) % q.options.length));
      return scoreQuiz(c, answers);
    });
    for (const r of results) expect(r.passed).toBe(r.pct >= c.passPct);
  });
  it("rejects a wrong number of answers", () => {
    expect(() => scoreQuiz(c, right.slice(1))).toThrow(InvalidPicksError);
    expect(() => scoreQuiz(c, [...right, 0])).toThrow(InvalidPicksError);
  });
  it("rejects out-of-range, fractional and non-numeric answers", () => {
    for (const bad of [99, -1, 0.5, "1", null, Number.NaN]) {
      const answers: unknown[] = [...right];
      answers[0] = bad;
      expect(() => scoreQuiz(c, answers)).toThrow(InvalidPicksError);
    }
  });
  it("rejects input that is not an array", () => {
    expect(() => scoreQuiz(c, null)).toThrow(InvalidPicksError);
    expect(() => scoreQuiz(c, "0,1,2")).toThrow(InvalidPicksError);
  });
});
