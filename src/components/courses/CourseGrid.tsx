"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { AUDIENCE_LABEL, totalMinutes } from "@/lib/courses/labels";
import type { Audience, Course } from "@/lib/courses/schema";
import { CourseSummary, XpPill, lessonWord } from "./CourseCard";

type Filter = "all" | Audience;

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "Visi" },
  { value: "mokiniai", label: AUDIENCE_LABEL.mokiniai },
  { value: "suaugusieji", label: AUDIENCE_LABEL.suaugusieji },
  { value: "verslas", label: AUDIENCE_LABEL.verslas },
];

/** Filterable course grid with a syllabus preview dialog. */
export function CourseGrid({ courses }: { courses: Course[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<Course | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const shown = courses.filter((c) => filter === "all" || c.audience === filter);

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <div className="grid gap-6">
      <div role="group" aria-label="Kursų filtras" className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            aria-pressed={filter === f.value}
            onClick={() => setFilter(f.value)}
            className={`rounded-md border px-3.5 py-2 font-display text-[14px] font-medium transition-colors duration-200 ${
              filter === f.value ? "border-brand bg-brand text-on-brand" : "border-line-2 bg-surface hover:bg-surface-2"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <ul className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(100%,300px),1fr))]">
        {shown.map((c) => (
          <li key={c.slug} className="flex">
            <article className="flex w-full min-w-0 flex-col gap-3.5 rounded-[10px] bg-surface p-6 shadow-[inset_0_0_0_1px_var(--edge)] transition-[transform,box-shadow] duration-500 ease-snap hover:-translate-y-1 hover:shadow-[inset_0_0_0_1px_var(--edge),0_30px_50px_-30px_rgb(30_42_90/0.4)]">
              <CourseSummary course={c} />
              <div className="mt-auto flex flex-wrap items-center justify-between gap-2.5 border-t border-line pt-3.5">
                <XpPill xp={c.xp} />
                <div className="flex flex-wrap gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setOpen(c)} aria-haspopup="dialog">
                    Peržiūrėti programą
                  </Button>
                </div>
              </div>
            </article>
          </li>
        ))}
      </ul>
      {shown.length === 0 ? <p className="text-ink-2">Šioje grupėje kursų kol kas nėra.</p> : null}

      <dialog
        ref={dialogRef}
        aria-labelledby="syllabus-title"
        onClose={() => setOpen(null)}
        onClick={(e) => {
          if (e.target === e.currentTarget) setOpen(null);
        }}
        className="m-auto max-h-[calc(100dvh-32px)] w-[min(540px,calc(100vw-32px))] overflow-auto rounded-[10px] shadow-[inset_0_0_0_1px_var(--edge)] bg-surface p-0 text-ink shadow-[0_30px_80px_-20px_rgba(0,0,0,.45)] backdrop:bg-black/55"
      >
        {open ? (
          <div className="grid gap-4 p-7">
            <div className="grid gap-1.5">
              <h3 id="syllabus-title" className="text-[22px] font-bold">
                {open.title}
              </h3>
              <p className="text-sm text-ink-2">
                {AUDIENCE_LABEL[open.audience]}, {open.lessons.length} {lessonWord(open.lessons.length)}, apie {totalMinutes(open)} min.
              </p>
            </div>
            <p className="text-[15px]">{open.summary}</p>
            <ol className="grid gap-2 pl-5 text-[15px] [list-style:decimal]">
              {open.lessons.map((l) => (
                <li key={l.slug}>
                  {l.title} <span className="font-mono text-[13px] text-ink-2">({l.minutes} min.)</span>
                </li>
              ))}
              <li>Baigiamasis testas ({open.quiz.length} klausimai, išlaikymui reikia {open.passPct}&nbsp;%)</li>
            </ol>
            <p className="text-[15px]">
              {open.certificate ? "Baigus kursą gausi PDF sertifikatą su unikaliu kodu." : "Šis kursas sertifikato neišduoda."} Už kursą gausi{" "}
              <b className="font-mono">+{open.xp}</b> XP.
            </p>
            <div className="flex flex-wrap justify-end gap-2.5">
              <Button variant="ghost" onClick={() => setOpen(null)}>
                Uždaryti
              </Button>
              <Button href={`/kursai/${open.slug}`} arrow>
                Pradėti kursą
              </Button>
            </div>
          </div>
        ) : null}
      </dialog>
    </div>
  );
}
