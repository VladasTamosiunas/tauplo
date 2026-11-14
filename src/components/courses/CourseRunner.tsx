"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { completeLessonAction, submitQuizAction } from "@/app/kursai/actions";
import { BADGES } from "@/lib/progress/badges";
import { Button, DownloadLink } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { lessonWord } from "./CourseCard";
import type { QuizSubmission } from "@/server/progress";

export type PublicLesson = { slug: string; title: string; minutes: number; body: string[]; takeaway: string };
/** The quiz as the browser sees it: no correct answers and no explanations until the server replies. */
export type PublicQuestion = { q: string; options: string[] };

type Props = {
  courseSlug: string;
  courseTitle: string;
  xp: number;
  certificateOffered: boolean;
  passPct: number;
  lessons: PublicLesson[];
  quiz: PublicQuestion[];
  signedIn: boolean;
  doneLessons: string[];
  certificateId: string | null;
  alreadyCompleted: boolean;
};

export function CourseRunner(props: Props) {
  const { courseSlug, lessons, quiz, signedIn } = props;
  const [done, setDone] = useState<Set<string>>(new Set(props.doneLessons));
  const [active, setActive] = useState(() => {
    const firstOpen = lessons.findIndex((l) => !props.doneLessons.includes(l.slug));
    return firstOpen === -1 ? lessons.length : firstOpen; // lessons.length = the quiz
  });
  const [message, setMessage] = useState("");
  const [answers, setAnswers] = useState<(number | null)[]>(() => quiz.map(() => null));
  const [result, setResult] = useState<QuizSubmission | null>(null);
  const [certificateId, setCertificateId] = useState(props.certificateId);
  const [pending, start] = useTransition();

  const onQuiz = active >= lessons.length;
  const lesson = lessons[active];
  const allRead = lessons.every((l) => done.has(l.slug));

  function finishLesson() {
    if (!lesson) return;
    setMessage("");
    if (!signedIn) {
      setDone((d) => new Set(d).add(lesson.slug));
      setActive((a) => a + 1);
      return;
    }
    start(async () => {
      const r = await completeLessonAction(courseSlug, lesson.slug);
      if (!r.ok) return setMessage(r.error);
      setDone((d) => new Set(d).add(lesson.slug));
      setActive((a) => a + 1);
    });
  }

  function submit() {
    setMessage("");
    start(async () => {
      const r = await submitQuizAction(courseSlug, answers);
      if (!r.ok) return setMessage(r.error);
      setResult(r.result);
      if (r.result.certificateId) setCertificateId(r.result.certificateId);
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)] lg:items-start">
      <nav aria-label="Kurso eiga" className="grid gap-3 rounded-[10px] shadow-[inset_0_0_0_1px_var(--edge)] bg-surface p-5 lg:sticky lg:top-24">
        <ProgressBar value={[...done].length} max={lessons.length} label="Perskaitytos pamokos" />
        <p className="font-mono text-[13px] text-ink-2">
          {[...done].length} / {lessons.length} {lessonWord(lessons.length)}
        </p>
        <ol className="grid gap-1">
          {lessons.map((l, i) => (
            <li key={l.slug}>
              <button
                type="button"
                onClick={() => setActive(i)}
                aria-current={active === i ? "step" : undefined}
                className={`flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left text-sm ${
                  active === i ? "bg-brand-soft font-semibold" : "hover:bg-surface-2"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`mt-0.5 grid size-[18px] shrink-0 place-items-center rounded-full border text-[11px] ${
                    done.has(l.slug) ? "border-brand bg-brand text-on-brand" : "border-line-2"
                  }`}
                >
                  {done.has(l.slug) ? "✓" : ""}
                </span>
                <span>
                  {l.title}
                  {done.has(l.slug) ? <span className="sr-only"> (perskaityta)</span> : null}
                </span>
              </button>
            </li>
          ))}
          <li>
            <button
              type="button"
              disabled={!allRead}
              onClick={() => setActive(lessons.length)}
              aria-current={onQuiz ? "step" : undefined}
              className={`flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left text-sm disabled:opacity-50 ${
                onQuiz ? "bg-brand-soft font-semibold" : "hover:bg-surface-2"
              }`}
            >
              <span aria-hidden="true" className="mt-0.5 size-[18px] shrink-0 rounded-full border border-line-2" />
              Baigiamasis testas
            </button>
          </li>
        </ol>
      </nav>

      <section className="min-w-0 rounded-[10px] shadow-[inset_0_0_0_1px_var(--edge)] bg-surface p-6 sm:p-8" aria-live="polite">
        {!signedIn ? (
          <p className="mb-5 rounded-lg bg-surface-2 p-3.5 text-sm">
            Skaitai kaip svečias, todėl pažanga neišsaugoma.{" "}
            <Link href="/registruotis" className="font-semibold underline">
              Susikurk paskyrą
            </Link>
            , kad rinktum XP ir gautum sertifikatą.
          </p>
        ) : null}

        {!onQuiz && lesson ? (
          <article className="grid gap-4">
            <div className="flex flex-wrap items-center gap-2 text-[13px] text-ink-2">
              <span>
                Pamoka {active + 1} iš {lessons.length}
              </span>
              <span className="font-mono">{lesson.minutes} min.</span>
            </div>
            <h2 className="text-[26px] font-medium leading-tight">{lesson.title}</h2>
            <div className="grid max-w-[65ch] gap-3.5 text-[16.5px] leading-[1.65]">
              {lesson.body.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </div>
            <aside className="max-w-[65ch] rounded-lg border border-line bg-brand-soft p-4">
              <b className="font-display">Verta prisiminti</b>
              <p className="mt-1">{lesson.takeaway}</p>
            </aside>
            {message ? (
              <p role="alert" className="text-sm font-medium text-bad-ink">
                {message}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2.5">
              {active > 0 ? (
                <Button variant="ghost" onClick={() => setActive(active - 1)}>
                  Atgal
                </Button>
              ) : null}
              <Button onClick={finishLesson} disabled={pending}>
                {done.has(lesson.slug)
                  ? active === lessons.length - 1 ? "Eiti į testą" : "Kita pamoka"
                  : active === lessons.length - 1 ? "Perskaičiau, eiti į testą" : "Perskaičiau, toliau"}
              </Button>
            </div>
          </article>
        ) : (
          <article className="grid gap-5">
            <div className="grid gap-1">
              <h2 className="text-[26px] font-medium leading-tight">Baigiamasis testas</h2>
              <p className="text-sm text-ink-2">
                {quiz.length} klausimai. Išlaikymui reikia {props.passPct}&nbsp;%.
                {props.alreadyCompleted || result?.xpGained ? "" : ` Už kursą gausi +${props.xp} XP.`}
              </p>
            </div>

            {result ? (
              <div className="grid gap-4">
                <div
                  role="status"
                  className={`grid gap-2 rounded-lg border p-4 ${result.quiz.passed ? "border-good bg-good-soft" : "border-bad bg-bad-soft"}`}
                >
                  <strong className={`font-display text-lg ${result.quiz.passed ? "text-good-ink" : "text-bad-ink"}`}>
                    {result.quiz.passed ? "Testas išlaikytas" : "Šį kartą nepavyko"}
                  </strong>
                  <p>
                    Teisingi atsakymai: <b className="font-mono">{result.quiz.correct} / {result.quiz.total}</b> ({result.quiz.pct}&nbsp;%).
                  </p>
                  {result.quiz.passed && result.xpGained > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      <Pill tone="xp">+{result.xpGained} XP</Pill>
                      {result.iqGained > 0 ? <Pill tone="good">Finansinis IQ +{result.iqGained}</Pill> : null}
                      {result.newBadges.map((s) => (
                        <Pill key={s} tone="xp">
                          Ženklelis: {BADGES.find((b) => b.slug === s)?.name ?? s}
                        </Pill>
                      ))}
                    </div>
                  ) : null}
                  {!result.quiz.passed ? <p className="text-sm">Pakartok pamokas ir pabandyk dar kartą. Bandymų skaičius neribojamas.</p> : null}
                </div>
                {certificateId ? <CertificateLink id={certificateId} /> : null}
                <div className="flex flex-wrap gap-2.5">
                  {!result.quiz.passed ? (
                    <Button
                      onClick={() => {
                        setResult(null);
                        setAnswers(quiz.map(() => null));
                      }}
                    >
                      Bandyti iš naujo
                    </Button>
                  ) : null}
                  <Button href="/kursai" variant="ghost">
                    Visi kursai
                  </Button>
                </div>
              </div>
            ) : !signedIn ? (
              <p className="rounded-lg bg-surface-2 p-4">
                Testą gali laikyti tik prisijungęs. {" "}
                <Link href="/prisijungti" className="font-semibold underline">
                  Prisijungti
                </Link>{" "}
                arba{" "}
                <Link href="/registruotis" className="font-semibold underline">
                  registruotis
                </Link>
                .
              </p>
            ) : !allRead ? (
              <p className="rounded-lg bg-surface-2 p-4">Pirmiausia perskaityk visas kurso pamokas.</p>
            ) : (
              <>
                {props.alreadyCompleted && certificateId ? <CertificateLink id={certificateId} /> : null}
                <ol className="grid gap-6">
                  {quiz.map((q, qi) => (
                    <li key={q.q}>
                      <fieldset className="grid gap-2.5">
                        <legend className="mb-1 text-base font-semibold">
                          {qi + 1}. {q.q}
                        </legend>
                        {q.options.map((o, oi) => (
                          <label
                            key={o}
                            className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-line-2 bg-surface px-3.5 py-3 has-[:checked]:border-brand has-[:checked]:bg-brand-soft has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2"
                          >
                            <input
                              type="radio"
                              name={`q${qi}`}
                              checked={answers[qi] === oi}
                              onChange={() => setAnswers((a) => a.map((x, i) => (i === qi ? oi : x)))}
                              className="mt-1 accent-[var(--brand)]"
                            />
                            <span>{o}</span>
                          </label>
                        ))}
                      </fieldset>
                    </li>
                  ))}
                </ol>
                {message ? (
                  <p role="alert" className="text-sm font-medium text-bad-ink">
                    {message}
                  </p>
                ) : null}
                <div>
                  <Button onClick={submit} disabled={pending || answers.some((a) => a === null)}>
                    {pending ? "Tikrinama..." : "Pateikti atsakymus"}
                  </Button>
                  {answers.some((a) => a === null) ? <p className="mt-2 text-[13px] text-ink-2">Atsakyk į visus klausimus.</p> : null}
                </div>
              </>
            )}
          </article>
        )}
      </section>
    </div>
  );
}

function CertificateLink({ id }: { id: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface-2 p-4">
      <div>
        <b className="font-display">Tavo sertifikatas paruoštas</b>
        <p className="font-mono text-[13px] text-ink-2">{id}</p>
      </div>
      {/* A plain anchor on purpose: this is a file download from a route handler, not a page. */}
      <DownloadLink href={`/sertifikatai/${id}`}>Atsisiųsti PDF</DownloadLink>
    </div>
  );
}
