import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { BADGES } from "@/lib/progress/badges";
import type { ProgressResult } from "@/server/progress";

export type SaveState =
  | { status: "guest" }
  | { status: "saving" }
  | { status: "saved"; progress: ProgressResult }
  | { status: "error"; message: string }
  | { status: "demo" };

/** The block under a finished game: what was earned, or why it was not saved. */
export function SaveSummary({ state, fullGameHref }: { state: SaveState; fullGameHref?: string }) {
  if (state.status === "saving") return <p className="text-sm text-ink-2" role="status">Saugomas rezultatas...</p>;
  if (state.status === "error")
    return (
      <p role="alert" className="rounded-lg border border-bad bg-bad-soft px-4 py-3 text-sm font-medium text-bad-ink">
        {state.message}
      </p>
    );
  if (state.status === "saved") {
    const p = state.progress;
    return (
      <div className="grid gap-3" role="status">
        <div className="flex flex-wrap items-center gap-2">
          <Pill tone="xp">+{p.xpGained} XP</Pill>
          {p.iqGained > 0 ? <Pill tone="good">Finansinis IQ +{p.iqGained}</Pill> : null}
          <Pill tone="plain">{p.level} lygis</Pill>
        </div>
        {p.newBadges.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {p.newBadges.map((slug) => (
              <li key={slug}>
                <Pill tone="xp">Ženklelis: {BADGES.find((b) => b.slug === slug)?.name ?? slug}</Pill>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  }
  if (state.status === "demo") {
    return (
      <div className="grid gap-3 rounded-lg bg-surface-2 p-4">
        <p className="text-sm">Tai tik trumpas demonstracinis variantas. Pilname žaidime laukia daugiau dilemų, o rezultatas išsaugomas tavo profilyje.</p>
        {fullGameHref ? (
          <div>
            <Button href={fullGameHref} size="sm">
              Žaisti visą žaidimą
            </Button>
          </div>
        ) : null}
      </div>
    );
  }
  return (
    <div className="grid gap-3 rounded-lg bg-surface-2 p-4">
      <p className="text-sm">
        Žaidei kaip svečias, todėl rezultatas neišsaugotas. Susikurk paskyrą, kad rinktum XP, ženklelius ir didintum Finansinį IQ.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button href="/registruotis" size="sm">
          Registruotis
        </Button>
        <Link href="/prisijungti" className="inline-flex items-center px-2 text-sm font-semibold underline">
          Jau turiu paskyrą
        </Link>
      </div>
    </div>
  );
}
