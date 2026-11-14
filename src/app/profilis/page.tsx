import type { Metadata } from "next";
import Link from "next/link";
import { BadgeGrid } from "@/components/profile/BadgeGrid";
import { IqRing } from "@/components/profile/IqRing";
import { Button, DownloadLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { requireUser } from "@/lib/auth/session";
import { getCourse, getCourses } from "@/lib/courses/catalog";
import { db } from "@/lib/db";
import { formatNumber, pluralLt } from "@/lib/format";
import { levelFromXp } from "@/lib/progress/xp";
import { listJoinedClassrooms } from "@/server/classrooms";

export const metadata: Metadata = { title: "Mano profilis" };

const ROLE_LABEL = { STUDENT: "Moksleivis / Studentas", ADULT: "Suaugęs besimokantysis", TEACHER: "Mokytojas / Institucijos atstovas" } as const;

export default async function ProfilePage() {
  const user = await requireUser();
  const [badges, lessons, completions, certificates, rooms] = await Promise.all([
    db.badgeAward.findMany({ where: { userId: user.id }, select: { badgeSlug: true } }),
    db.lessonProgress.findMany({ where: { userId: user.id }, select: { courseSlug: true } }),
    db.courseCompletion.findMany({ where: { userId: user.id }, select: { courseSlug: true } }),
    db.certificate.findMany({ where: { userId: user.id }, orderBy: { issuedAt: "desc" }, select: { id: true, courseSlug: true } }),
    listJoinedClassrooms(user.id),
  ]);

  const level = levelFromXp(user.xp);
  const readByCourse = new Map<string, number>();
  for (const l of lessons) readByCourse.set(l.courseSlug, (readByCourse.get(l.courseSlug) ?? 0) + 1);
  const done = new Set(completions.map((c) => c.courseSlug));
  const started = getCourses().filter((c) => readByCourse.has(c.slug) || done.has(c.slug));

  return (
    <div className="mx-auto grid max-w-[1120px] gap-8 px-4 py-12 sm:px-6">
      <div className="grid gap-2">
        <h1 className="text-[clamp(32px,4.2vw,48px)] font-medium leading-[1.1]">Labas, {user.displayName}</h1>
        <p className="text-ink-2">{ROLE_LABEL[user.role]}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-[auto_1fr_1fr]">
        <Card className="grid place-items-center">
          <IqRing value={user.financialIq} />
        </Card>
        <Card className="grid content-between gap-4">
          <div className="grid gap-1">
            <span className="text-[13px] text-ink-2">Lygis</span>
            <span className="font-mono text-[40px] font-bold leading-none">{level.level}</span>
          </div>
          <div className="grid gap-2">
            <ProgressBar value={level.xpIntoLevel} max={level.xpForNext} label="Pažanga iki kito lygio" tone="reward" />
            <p className="font-mono text-[13px] text-ink-2">
              {formatNumber(level.xpIntoLevel)} / {formatNumber(level.xpForNext)} XP iki kito lygio
            </p>
          </div>
          <Pill tone="xp" className="w-fit">
            {formatNumber(user.xp)}&nbsp;XP iš viso
          </Pill>
        </Card>
        <Card className="grid content-between gap-4">
          <div className="grid gap-1">
            <span className="text-[13px] text-ink-2">Mokymosi serija</span>
            <span className="font-mono text-[40px] font-bold leading-none">
              {user.streakCount}{" "}
              <span className="font-sans text-base font-medium text-ink-2">{pluralLt(user.streakCount, "diena", "dienos", "dienų")}</span>
            </span>
          </div>
          <p className="text-sm text-ink-2">
            Ilgiausia serija: <b className="font-mono text-ink">{user.longestStreak}</b>. Serija auga, kai mokaisi kiekvieną dieną.
          </p>
        </Card>
      </div>

      <section className="grid gap-4" aria-labelledby="badges-h">
        <h2 id="badges-h" className="text-2xl font-bold">
          Ženkleliai
        </h2>
        <BadgeGrid earned={badges.map((b) => b.badgeSlug)} />
      </section>

      <section className="grid gap-4" aria-labelledby="courses-h">
        <h2 id="courses-h" className="text-2xl font-bold">
          Mano kursai
        </h2>
        {started.length === 0 ? (
          <Card className="grid justify-items-start gap-3">
            <p className="text-ink-2">Dar nepradėjai nė vieno kurso. Pasirink pirmąjį ir surink savo pirmąjį XP.</p>
            <Button href="/kursai">Peržiūrėti kursus</Button>
          </Card>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {started.map((c) => {
              const read = Math.min(readByCourse.get(c.slug) ?? 0, c.lessons.length);
              return (
                <Card as="li" key={c.slug} className="grid gap-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <Link href={`/kursai/${c.slug}`} className="text-[17px] font-bold hover:underline">
                      {c.title}
                    </Link>
                    {done.has(c.slug) ? <Pill tone="good">Baigtas</Pill> : null}
                  </div>
                  <ProgressBar value={read} max={c.lessons.length} label={`${c.title}: perskaitytos pamokos`} />
                  <p className="font-mono text-[13px] text-ink-2">
                    {read} / {c.lessons.length} {pluralLt(c.lessons.length, "pamoka", "pamokos", "pamokų")}
                  </p>
                </Card>
              );
            })}
          </ul>
        )}
      </section>

      <section className="grid gap-4" aria-labelledby="cert-h">
        <h2 id="cert-h" className="text-2xl font-bold">
          Sertifikatai
        </h2>
        {certificates.length === 0 ? (
          <p className="text-ink-2">Sertifikatą gausi išlaikęs kurso, kuris jį išduoda, baigiamąjį testą.</p>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {certificates.map((c) => (
              <Card as="li" key={c.id} className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <b className="font-display">{getCourse(c.courseSlug)?.title ?? c.courseSlug}</b>
                  <p className="font-mono text-[13px] text-ink-2">{c.id}</p>
                </div>
                <DownloadLink href={`/sertifikatai/${c.id}`} variant="ghost" size="sm">
                  Atsisiųsti PDF
                </DownloadLink>
              </Card>
            ))}
          </ul>
        )}
      </section>

      {user.role !== "TEACHER" ? (
        <section className="grid gap-4" aria-labelledby="class-h">
          <h2 id="class-h" className="text-2xl font-bold">
            Mano klasės
          </h2>
          {rooms.length === 0 ? <p className="text-ink-2">Dar nesi prisijungęs prie jokios klasės ar kampanijos.</p> : (
            <ul className="flex flex-wrap gap-2">
              {rooms.map((r) => (
                <li key={r.id}>
                  <Pill tone="level2">{r.name}</Pill>
                </li>
              ))}
            </ul>
          )}
          <div>
            <Button href="/klase" variant="ghost">
              Prisijungti kodu
            </Button>
          </div>
        </section>
      ) : (
        <div>
          <Button href="/mokytojas">Eiti į mokytojo skydelį</Button>
        </div>
      )}
    </div>
  );
}
