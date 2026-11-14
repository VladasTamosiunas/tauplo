import type { Metadata } from "next";
import { JoinForm } from "@/components/classroom/JoinForm";
import { Card } from "@/components/ui/Card";
import { requireUser } from "@/lib/auth/session";
import { listJoinedClassrooms } from "@/server/classrooms";

export const metadata: Metadata = { title: "Prisijungti prie klasės" };

export default async function JoinClassPage() {
  const user = await requireUser(["STUDENT", "ADULT"]);
  const rooms = await listJoinedClassrooms(user.id);
  return (
    <div className="mx-auto grid max-w-[560px] gap-6 px-4 py-14 sm:px-6">
      <div className="grid gap-2">
        <h1 className="text-4xl font-medium">Prisijungti prie klasės</h1>
        <p className="text-ink-2">Įvesk kodą, kurį gavai iš mokytojo ar organizatoriaus. Mokytojas matys tik anoniminę grupės suvestinę, o ne tavo vardą ar rezultatus.</p>
      </div>
      <Card className="shadow-card">
        <JoinForm />
      </Card>
      {rooms.length > 0 ? (
        <section className="grid gap-2" aria-labelledby="mine-h">
          <h2 id="mine-h" className="text-lg font-bold">
            Jau prisijungta
          </h2>
          <ul className="grid gap-1 text-ink-2">
            {rooms.map((r) => (
              <li key={r.id}>{r.name}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
