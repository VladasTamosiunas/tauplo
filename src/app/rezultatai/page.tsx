import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { getCurrentUser } from "@/lib/auth/session";
import { formatNumber } from "@/lib/format";
import { leaderboard } from "@/server/classrooms";

export const metadata: Metadata = {
  title: "Rezultatų lentelė",
  description: "Moksleivių ir studentų XP lentelė. Rodomi tik slapyvardžiai.",
};

export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
  const [rows, user] = await Promise.all([leaderboard(20), getCurrentUser()]);
  return (
    <div className="mx-auto grid max-w-[760px] gap-8 px-4 py-14 sm:px-6">
      <div className="grid gap-3">
        <h1 className="text-[clamp(32px,4.2vw,48px)] font-medium leading-[1.1]">Rezultatų lentelė</h1>
        <p className="text-[17px] text-ink-2">Dvidešimt moksleivių ir studentų, surinkusių daugiausia XP. Rodomi tik slapyvardžiai.</p>
      </div>
      {rows.length === 0 ? (
        <Card className="grid justify-items-start gap-3">
          <p className="text-ink-2">Lentelė dar tuščia. Būk pirmas: sužaisk žaidimą ar perskaityk pamoką.</p>
          <Link href="/zaidimai" className="font-semibold underline">
            Pradėti nuo žaidimo
          </Link>
        </Card>
      ) : (
        <Card className="overflow-x-auto !p-0">
          <table className="w-full min-w-[420px] text-left">
            <caption className="sr-only">XP lentelė</caption>
            <thead>
              <tr className="border-b border-line text-[13px] text-ink-2">
                <th scope="col" className="px-5 py-3 font-medium">Vieta</th>
                <th scope="col" className="px-5 py-3 font-medium">Slapyvardis</th>
                <th scope="col" className="px-5 py-3 font-medium">Lygis</th>
                <th scope="col" className="px-5 py-3 text-right font-medium">XP</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const me = user?.displayName === r.displayName;
                return (
                  <tr key={r.rank} className={`border-b border-line last:border-0 ${me ? "bg-brand-soft" : ""}`}>
                    <td className="px-5 py-3 font-mono">{r.rank}</td>
                    <td className="px-5 py-3 font-semibold">{r.displayName}</td>
                    <td className="px-5 py-3 font-mono">{r.level}</td>
                    <td className="px-5 py-3 text-right font-mono">{formatNumber(r.xp)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
