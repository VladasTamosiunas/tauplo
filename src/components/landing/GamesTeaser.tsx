import Link from "next/link";
import { ScenarioPlayer } from "@/components/games/ScenarioPlayer";
import { Bezel } from "@/components/ui/Card";
import { GAMES, getScenario } from "@/lib/games/catalog";
import { VOYAGE_YEARS } from "@/lib/games/voyage-years";
import { ScenarioSchema } from "@/lib/games/schema";
import { TOPICS } from "@/lib/topics";

/** First two dilemmas of the budget game, playable right on the landing page. */
function demoScenario() {
  const full = getScenario("biudzeto-detektyvas")!;
  return ScenarioSchema.parse({ ...full, steps: full.steps.slice(0, 2) });
}

const LEAD: Record<string, string> = {
  "biudzeto-detektyvas": "Penkios tikros dilemos, vienas mėnesio biudžetas.",
  "sukciu-medziokle": "Dešimt žinučių, penkiolika sekundžių kiekvienai.",
  "mokesciu-labirintas": "Pats apskaičiuok VSD, PSD ir GPM.",
  "kursiu-mariu-kapitonas": "3D: keturi skirtingi metai, trys uostai, vienas laivas.",
};

/** The playable demo is the main object; the games hang beside it as an index with hairline rules. */
export function GamesTeaser({ signedIn }: { signedIn: boolean }) {
  return (
    <section id="zaisk" className="mx-auto grid max-w-[1120px] gap-10 border-t border-line px-4 py-20 sm:px-6 lg:py-24" aria-labelledby="games-h">
      <h2 id="games-h" className="reveal max-w-[22ch] text-[clamp(28px,3.4vw,40px)] font-medium leading-[1.12]">
        Išbandyk dabar, be registracijos
      </h2>

      <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:gap-14">
        <div className="reveal">
          <Bezel>
            <ScenarioPlayer scenario={demoScenario()} signedIn={signedIn} demo fullGameHref="/zaidimai/biudzeto-detektyvas" />
          </Bezel>
        </div>

        <ul className="border-t border-line">
          {GAMES.filter((g) => !VOYAGE_YEARS.some((y) => y.slug === g.slug) || g.slug === "kursiu-mariu-kapitonas").map((g, i) => (
            <li key={g.slug} className="reveal border-b border-line" style={{ ["--i" as string]: i + 1 }}>
              <Link href={`/zaidimai/${g.slug === "kursiu-mariu-kapitonas" ? VOYAGE_YEARS[0].slug : g.slug}`} className="group grid grid-cols-[1fr_auto] items-baseline gap-4 py-5 transition-colors duration-200 ease-snap hover:bg-surface-2/60">
                <span className="grid gap-1">
                  <span className="text-[12.5px] text-ink-2">
                    {TOPICS[g.topic]}, apie {g.minutes} min.
                  </span>
                  <span className="font-serif text-[22px] font-medium leading-tight tracking-[-0.01em]">{g.title}</span>
                  <span className="text-[14.5px] text-ink-2">{LEAD[g.slug]}</span>
                </span>
                <span aria-hidden="true" className="text-ink-2 transition-transform duration-200 ease-snap group-hover:-translate-y-px group-hover:translate-x-px group-hover:text-ink">
                  <span className="arrow" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
