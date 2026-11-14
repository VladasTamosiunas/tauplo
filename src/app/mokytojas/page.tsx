import type { Metadata } from "next";
import Link from "next/link";
import { CreateRoomForm } from "@/components/classroom/CreateRoomForm";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { requireUser } from "@/lib/auth/session";
import { pluralLt } from "@/lib/format";
import { listClassrooms, MIN_COHORT } from "@/server/classrooms";

export const metadata: Metadata = { title: "Mokytojo skydelis" };

export default async function TeacherPage() {
  const user = await requireUser(["TEACHER"]);
  const rooms = await listClassrooms(user.id);
  return (
    <div className="mx-auto grid max-w-[1120px] gap-8 px-4 py-12 sm:px-6">
      <div className="grid max-w-[62ch] gap-2">
        <h1 className="text-[clamp(32px,4.2vw,48px)] font-medium leading-[1.1]">Mokytojo skydelis</h1>
        <p className="text-ink-2">
          Sukurk klasę ar kampaniją, duok mokiniams kodą ir stebėk anoniminę pažangą. Statistika rodoma nuo {MIN_COHORT} dalyvių, kad nebūtų galima atpažinti atskiro mokinio.
        </p>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[1.3fr_1fr]">
        <section className="grid gap-4" aria-labelledby="rooms-h">
          <h2 id="rooms-h" className="text-2xl font-bold">
            Mano klasės ir kampanijos
          </h2>
          {rooms.length === 0 ? (
            <Card className="text-ink-2">Dar nesukūrei nė vienos. Užpildyk formą ir gausi prisijungimo kodą.</Card>
          ) : (
            <ul className="grid gap-3">
              {rooms.map((r) => (
                <Card as="li" key={r.id} className="flex flex-wrap items-center justify-between gap-3">
                  <div className="grid gap-1">
                    <Link href={`/mokytojas/${r.id}`} className="text-[18px] font-bold hover:underline">
                      {r.name}
                    </Link>
                    <div className="flex flex-wrap items-center gap-2 text-sm text-ink-2">
                      <Pill tone="level2">{r.kind === "CLASS" ? "Klasė" : "Kampanija"}</Pill>
                      <span>
                        {r.members} {pluralLt(r.members, "dalyvis", "dalyviai", "dalyvių")}
                      </span>
                    </div>
                  </div>
                  <code className="rounded-lg border border-line bg-surface-2 px-3 py-1.5 font-mono text-base font-bold">{r.joinCode}</code>
                </Card>
              ))}
            </ul>
          )}
        </section>

        <Card className="grid gap-4 shadow-card">
          <h2 className="text-xl font-bold">Nauja klasė ar kampanija</h2>
          <CreateRoomForm />
        </Card>
      </div>
    </div>
  );
}
