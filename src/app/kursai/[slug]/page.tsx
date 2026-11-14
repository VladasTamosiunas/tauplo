import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CourseRunner } from "@/components/courses/CourseRunner";
import { Pill } from "@/components/ui/Pill";
import { getCurrentUser } from "@/lib/auth/session";
import { getCourse, getCourses } from "@/lib/courses/catalog";
import { AUDIENCE_LABEL, LEVEL_LABEL } from "@/lib/courses/labels";
import { db } from "@/lib/db";

type Params = { slug: string };

export function generateStaticParams(): Params[] {
  return getCourses().map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const course = getCourse((await params).slug);
  return course ? { title: course.title, description: course.summary } : {};
}

export default async function CoursePage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const course = getCourse(slug);
  if (!course) notFound();

  const user = await getCurrentUser();
  const [lessons, completion, certificate] = user
    ? await Promise.all([
        db.lessonProgress.findMany({ where: { userId: user.id, courseSlug: slug }, select: { lessonSlug: true } }),
        db.courseCompletion.findUnique({ where: { userId_courseSlug: { userId: user.id, courseSlug: slug } }, select: { userId: true } }),
        db.certificate.findUnique({ where: { userId_courseSlug: { userId: user.id, courseSlug: slug } }, select: { id: true } }),
      ])
    : [[], null, null];

  return (
    <div className="mx-auto grid max-w-[1120px] gap-6 px-4 py-10 sm:px-6">
      <div className="grid gap-3">
        <Link href="/kursai" className="w-fit text-sm font-semibold text-ink-2 underline underline-offset-4 hover:text-ink">
          Visi kursai
        </Link>
        <h1 className="text-[clamp(28px,3.4vw,40px)] font-medium leading-[1.12]">{course.title}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-ink-2">{AUDIENCE_LABEL[course.audience]}</span>
          <Pill tone={course.level === "pradedantieji" ? "level1" : "level2"}>{LEVEL_LABEL[course.level]}</Pill>
          {course.certificate ? <Pill tone="cert">Su sertifikatu</Pill> : null}
          <Pill tone="xp">+{course.xp}&nbsp;XP</Pill>
        </div>
      </div>

      <CourseRunner
        courseSlug={course.slug}
        courseTitle={course.title}
        xp={course.xp}
        certificateOffered={course.certificate}
        passPct={course.passPct}
        // Only what the browser needs: the quiz is sent WITHOUT its correct answers.
        lessons={course.lessons.map(({ slug: s, title, minutes, body, takeaway }) => ({ slug: s, title, minutes, body, takeaway }))}
        quiz={course.quiz.map(({ q, options }) => ({ q, options }))}
        signedIn={Boolean(user)}
        doneLessons={lessons.map((l) => l.lessonSlug)}
        certificateId={certificate?.id ?? null}
        alreadyCompleted={Boolean(completion)}
      />
    </div>
  );
}
