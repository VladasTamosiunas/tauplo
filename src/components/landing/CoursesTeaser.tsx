import Link from "next/link";
import { CourseSummary, XpPill } from "@/components/courses/CourseCard";
import { getCourse } from "@/lib/courses/catalog";

const panel =
  "bg-surface shadow-[0_0_0_1px_var(--line)] transition-[box-shadow,background-color] duration-200 ease-snap hover:shadow-[0_0_0_1px_var(--ink-2)]";

/**
 * One wide course and two narrower ones, deliberately unequal. The wide card lists its lessons,
 * which is what earns its size; the other two stay compact.
 */
export function CoursesTeaser() {
  const lead = getCourse("individuali-veikla")!;
  const a = getCourse("biudzetas-50-30-20")!;
  const b = getCourse("pagalve")!;

  return (
    <section className="mx-auto grid max-w-[1120px] gap-10 border-t border-line px-4 py-20 sm:px-6 lg:py-24" aria-labelledby="courses-h">
      <div className="reveal flex flex-wrap items-baseline justify-between gap-x-10 gap-y-3">
        <h2 id="courses-h" className="max-w-[22ch] text-[clamp(28px,3.4vw,40px)] font-medium leading-[1.12]">
          Kursai pagal gyvenimo etapą
        </h2>
        <Link href="/kursai" className="text-[14.5px] font-medium text-ink-2 underline decoration-line-2 underline-offset-[6px] transition-colors duration-200 ease-snap hover:text-ink hover:decoration-ink">
          Visi kursai
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:grid-rows-2">
        <Link href={`/kursai/${lead.slug}`} className={`reveal flex min-w-0 flex-col gap-5 rounded-[10px] p-7 sm:p-8 lg:row-span-2 ${panel}`}>
          <CourseSummary course={lead} />
          <ol className="mt-1 grid border-t border-line text-[15px]">
            {lead.lessons.slice(0, 5).map((l) => (
              <li key={l.slug} className="flex items-baseline justify-between gap-4 border-b border-line py-2.5">
                <span>{l.title}</span>
                <span className="shrink-0 font-mono text-[12.5px] text-ink-2">{l.minutes} min.</span>
              </li>
            ))}
          </ol>
          <div className="mt-auto pt-2">
            <XpPill xp={lead.xp} />
          </div>
        </Link>

        {[a, b].map((c, i) => (
          <Link key={c.slug} href={`/kursai/${c.slug}`} style={{ ["--i" as string]: i + 1 }} className={`reveal flex min-w-0 flex-col gap-4 rounded-[10px] p-6 ${panel}`}>
            <CourseSummary course={c} />
            <div className="mt-auto">
              <XpPill xp={c.xp} />
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
