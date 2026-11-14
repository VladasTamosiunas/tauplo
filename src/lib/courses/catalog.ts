import biudzetas from "../../content/courses/biudzetas-50-30-20.json";
import individuali from "../../content/courses/individuali-veikla.json";
import nereguliarios from "../../content/courses/nereguliarios-pajamos.json";
import pagalve from "../../content/courses/pagalve.json";
import pensijos from "../../content/courses/pensijos-ii-iii-pakopa.json";
import sukciai from "../../content/courses/sukciu-atpazinimas.json";
import { prepareContent } from "../content";
import { InvalidPicksError } from "../errors";
import { CourseSchema, type Course } from "./schema";

export { AUDIENCE_LABEL, LEVEL_LABEL, totalMinutes } from "./labels";

const COURSES: Course[] = [biudzetas, sukciai, pagalve, pensijos, individuali, nereguliarios].map((raw) =>
  CourseSchema.parse(prepareContent(raw)),
);

export function getCourses(): Course[] {
  return COURSES;
}

export function getCourse(slug: string): Course | undefined {
  return COURSES.find((c) => c.slug === slug);
}

export type QuizResult = { correct: number; total: number; pct: number; passed: boolean };

/** Scores a quiz on the server. Throws InvalidPicksError unless there is exactly one valid answer per question. */
export function scoreQuiz(c: Course, answers: unknown): QuizResult {
  if (!Array.isArray(answers) || answers.length !== c.quiz.length) throw new InvalidPicksError();
  let correct = 0;
  c.quiz.forEach((q, i) => {
    const a = answers[i];
    if (typeof a !== "number" || !Number.isInteger(a) || a < 0 || a >= q.options.length) throw new InvalidPicksError();
    if (a === q.correct) correct++;
  });
  const total = c.quiz.length;
  const pct = Math.round((correct / total) * 100);
  return { correct, total, pct, passed: pct >= c.passPct };
}
