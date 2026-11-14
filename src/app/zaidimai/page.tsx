import type { Metadata } from "next";
import { Button } from "@/components/ui/Button";
import { GAMES } from "@/lib/games/catalog";
import { VOYAGE_YEARS } from "@/lib/games/voyage-years";
import { TOPICS } from "@/lib/topics";

export const metadata: Metadata = {
  title: "Žaidimai",
  description: "Finansinio raštingumo žaidimai: biudžeto sprendimai, sukčių atpažinimas, mokesčių skaičiavimas ir 3D metų kelionės Kuršių mariose.",
};

const TEACHES: Record<string, string> = {
  "biudzeto-detektyvas": "Sprendi penkias tikras gyvenimo dilemas: remontas, deklaracija, išsimokėtinai ir sukčių SMS.",
  "sukciu-medziokle": "Greitai atpažink SMS žinutes, laiškus ir reklamas. Kiekvienam turi 15 sekundžių.",
  "mokesciu-labirintas": "Pradedi dirbti savarankiškai ir pats apskaičiuoji VSD, PSD bei GPM.",
  "kursiu-mariu-kapitonas": "3D žaidimas: dvylika mėnesių, trys uostai, vienas laivas. Keturi skirtingi metai: nuo ramių iki audringų, su draudimu, orų prognozėmis ir tikslais.",
};

/** A list, not a card grid: each game gets a full row with the title large and the action at the end. */
export default function GamesPage() {
  return (
    <div className="mx-auto grid max-w-[1120px] gap-10 px-4 pb-8 pt-12 sm:px-6 lg:pt-16">
      <div className="rise grid max-w-[22ch] gap-4">
        <h1 className="text-[clamp(32px,4.2vw,48px)] font-medium leading-[1.1]">Mokomieji žaidimai</h1>
      </div>
      <p className="rise max-w-[52ch] text-[18px] text-ink-2" style={{ ["--d" as string]: 2 }}>
        Žaisk kaip svečias arba prisijungęs. Prisijungus rezultatas išsaugomas, o už kiekvieną žaidimą gauni XP ir didini Finansinį IQ.
      </p>

      <ul className="border-t border-edge">
        {GAMES.filter((g) => !VOYAGE_YEARS.some((y) => y.slug === g.slug) || g.slug === "kursiu-mariu-kapitonas").map((g, i) => (
          <li key={g.slug} className="reveal grid items-center gap-x-10 gap-y-5 border-b border-edge py-9 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto]" style={{ ["--i" as string]: i }}>
            <div className="grid gap-2">
              <span className="text-[13px] font-medium text-ink-2">
                {TOPICS[g.topic]}, apie {g.minutes} min.
              </span>
              <h2 className="text-[clamp(24px,2.8vw,32px)] font-medium leading-[1.15]">{g.title}</h2>
            </div>
            <p className="max-w-[44ch] text-[16px] text-ink-2">{TEACHES[g.slug] ?? g.summary}</p>
            <Button href={`/zaidimai/${g.slug === "kursiu-mariu-kapitonas" ? VOYAGE_YEARS[0].slug : g.slug}`} arrow>
              Žaisti
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
