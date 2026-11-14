import { Pill } from "@/components/ui/Pill";
import { AUDIENCE_LABEL, LEVEL_LABEL, totalMinutes } from "@/lib/courses/labels";
import type { Course } from "@/lib/courses/schema";
import { formatNumber, pluralLt } from "@/lib/format";

export const lessonWord = (n: number) => pluralLt(n, "pamoka", "pamokos", "pamokų");

/** Card content only: the grid decides how to wrap it and where the actions go. */
export function CourseSummary({ course }: { course: Course }) {
  return (
    <>
      <span className="text-[12.5px] text-ink-2">{AUDIENCE_LABEL[course.audience]}</span>
      <h3 className="text-[19px] font-bold leading-tight">{course.title}</h3>
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone={course.level === "pradedantieji" ? "level1" : "level2"}>{LEVEL_LABEL[course.level]}</Pill>
        {course.certificate ? <Pill tone="cert">Su sertifikatu</Pill> : null}
      </div>
      <p className="font-mono text-[13px] font-medium text-ink-2">
        {course.lessons.length} {lessonWord(course.lessons.length)} / {totalMinutes(course)} min.
      </p>
    </>
  );
}

export function XpPill({ xp }: { xp: number }) {
  return <Pill tone="xp">+{formatNumber(xp)}&nbsp;XP</Pill>;
}
