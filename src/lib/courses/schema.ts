import { z } from "zod";
import { TOPIC_SLUGS } from "../topics";

export const AudienceSchema = z.enum(["mokiniai", "suaugusieji", "verslas"]);
export const LevelSchema = z.enum(["pradedantieji", "pazenge"]);
export type Audience = z.infer<typeof AudienceSchema>;
export type Level = z.infer<typeof LevelSchema>;

export const LessonSchema = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  minutes: z.number().int().positive(),
  /** Paragraphs. */
  body: z.array(z.string().min(1)).min(1),
  /** One sentence the learner should remember. */
  takeaway: z.string().min(1),
});

export const QuestionSchema = z.object({
  q: z.string().min(1),
  options: z.array(z.string().min(1)).min(2).max(5),
  correct: z.number().int().min(0),
  explain: z.string().min(1),
});

export const CourseSchema = z
  .object({
    slug: z.string().min(1),
    title: z.string().min(1),
    audience: AudienceSchema,
    level: LevelSchema,
    topic: z.enum(TOPIC_SLUGS),
    xp: z.number().int().positive(),
    certificate: z.boolean(),
    summary: z.string().min(1),
    passPct: z.number().int().min(1).max(100),
    lessons: z.array(LessonSchema).min(3),
    quiz: z.array(QuestionSchema).min(3),
  })
  .superRefine((c, ctx) => {
    c.quiz.forEach((q, i) => {
      if (q.correct >= q.options.length) {
        ctx.addIssue({ code: "custom", message: `quiz[${i}].correct is out of range`, path: ["quiz", i, "correct"] });
      }
    });
    const slugs = new Set<string>();
    c.lessons.forEach((l, i) => {
      if (slugs.has(l.slug)) ctx.addIssue({ code: "custom", message: `duplicate lesson slug ${l.slug}`, path: ["lessons", i, "slug"] });
      slugs.add(l.slug);
    });
  });

export type Lesson = z.infer<typeof LessonSchema>;
export type Question = z.infer<typeof QuestionSchema>;
export type Course = z.infer<typeof CourseSchema>;
