import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyCode } from "@/components/classroom/CopyCode";
import { Card } from "@/components/ui/Card";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { pluralLt } from "@/lib/format";
import { classroomStats, MIN_COHORT } from "@/server/classrooms";

export const metadata: Metadata = { title: "Klasės suvestinė" };
export const dynamic = "force-dynamic";

export default async function ClassroomPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser(["TEACHER"]);
  const { id } = await params;
  const room = await db.classroom.findFirst({ where: { id, ownerId: user.id }, select: { id: true, name: true, kind: true, joinCode: true } });
  if (!room) notFound();
  const stats = await classroomStats(room.id, user.id);
  if (!stats) notFound();

  return (
    <div className="mx-auto grid max-w-[1000px] gap-8 px-4 py-12 sm:px-6">
      <div className="grid gap-3">
        <Link href="/mokytojas" className="w-fit text-sm font-semibold text-ink-2 underline underline-offset-4 hover:text-ink">
          Visos klasės
        </Link>
        <h1 className="text-[clamp(28px,3.4vw,40px)] font-medium leading-[1.12]">{room.name}</h1>
        <div className="grid gap-1.5">
          <span className="text-sm text-ink-2">Prisijungimo kodas, kurį duok mokiniams</span>
          <CopyCode code={room.joinCode} />
        </div>
      </div>

      {stats.hidden ? (
        <Card className="grid gap-2 border-line-2">
          <h2 className="text-xl font-bold">
            {stats.members} {pluralLt(stats.members, "dalyvis", "dalyviai", "dalyvių")}
          </h2>
          <p className="max-w-[62ch] text-ink-2">
            Suvestinė bus rodoma, kai prisijungs bent {MIN_COHORT} dalyviai. Mažesnėje grupėje vidurkiai leistų atpažinti atskirą mokinį, todėl rodome tik dalyvių skaičių.
          </p>
        </Card>
      ) : (
        <>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Dalyviai", String(stats.members)],
              ["Vidutinis Finansinis IQ", String(stats.avgIq)],
              ["Baigti kursai", String(stats.coursesCompleted)],
              ["Žaidimų sesijos", String(stats.gameRuns)],
            ].map(([k, v]) => (
              <Card key={k} className="grid gap-1 !p-5">
                <dt className="text-[13px] text-ink-2">{k}</dt>
                <dd className="font-mono text-[30px] font-bold leading-tight">{v}</dd>
              </Card>
            ))}
          </dl>

          <section className="grid gap-4" aria-labelledby="topics-h">
            <h2 id="topics-h" className="text-2xl font-bold">
              Temų įsisavinimas
            </h2>
            {stats.topics.length === 0 ? (
              <Card className="text-ink-2">Kol kas nepakanka duomenų: tema rodoma, kai ją išbando bent {MIN_COHORT} dalyviai.</Card>
            ) : (
              <Card className="grid gap-4">
                <ul className="grid gap-3.5">
                  {stats.topics.map((t, i) => {
                    const weakest = i === stats.topics.length - 1 && stats.topics.length > 1 && t.pct < 60;
                    return (
                      <li key={t.slug} className="grid grid-cols-[minmax(0,9.5em)_1fr_3.4em] items-center gap-2.5 text-sm max-sm:grid-cols-[minmax(0,7.5em)_1fr_3.2em]">
                        <span className={weakest ? "font-semibold" : ""}>{t.name}</span>
                        <div
                          className="h-2.5 overflow-hidden rounded-full bg-surface-2"
                          role="progressbar"
                          aria-label={t.name}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-valuenow={t.pct}
                        >
                          <div className={`h-full rounded-full ${weakest ? "bg-bad" : "bg-chart"}`} style={{ width: `${t.pct}%` }} />
                        </div>
                        <b className="text-right font-mono text-[13px]">{t.pct}&nbsp;%</b>
                      </li>
                    );
                  })}
                </ul>
                {stats.topics.length > 1 && stats.topics[stats.topics.length - 1].pct < 60 ? (
                  <p className="text-[13px] font-medium text-bad-ink">
                    Silpniausia tema: {stats.topics[stats.topics.length - 1].name}. Verta skirti papildomą pamoką.
                  </p>
                ) : null}
              </Card>
            )}
          </section>
        </>
      )}

      <p className="text-[13px] text-ink-2">Čia rodoma tik grupės suvestinė. Mokinių vardų, el. pašto adresų ir atskirų rezultatų matyti negalima.</p>
    </div>
  );
}
