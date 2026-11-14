import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Bezel } from "@/components/ui/Card";
import { FraudPlayer } from "@/components/games/FraudPlayer";
import { ScenarioPlayer } from "@/components/games/ScenarioPlayer";
import { getCurrentUser } from "@/lib/auth/session";
import { VOYAGE_YEARS } from "@/lib/games/voyage-years";
import { YearSwitcher } from "@/components/games/voyage/YearSwitcher";
import { bestVoyageRun } from "@/server/progress";
import { VoyagePlayer } from "@/components/games/voyage/VoyagePlayer";
import { GAMES, getFraudDeck, getGame, getScenario, getVoyage } from "@/lib/games/catalog";
import { TAX_RULES } from "@/lib/games/tax-rules";

type Params = { slug: string };

export function generateStaticParams(): Params[] {
  return GAMES.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const game = getGame((await params).slug);
  return game ? { title: game.title, description: game.summary } : {};
}

export default async function GamePage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const game = getGame(slug);
  if (!game) notFound();
  const user = await getCurrentUser();
  const signedIn = Boolean(user);
  const scenario = game.kind === "scenario" ? getScenario(slug) : undefined;
  const deck = game.kind === "fraud" ? getFraudDeck(slug) : undefined;
  const voyage = game.kind === "voyage" ? getVoyage(slug) : undefined;
  // read BEFORE the new run is saved, so "your best" never includes the run the player just finished
  const best = voyage && user ? await bestVoyageRun(user.id, slug) : null;
  const previousBest = best ? { iq: best.iq, eur: best.eur } : null;
  const bests =
    voyage && user
      ? Object.fromEntries(await Promise.all(VOYAGE_YEARS.map(async (y) => [y.slug, (await bestVoyageRun(user.id, y.slug))?.iq ?? null] as const)))
      : undefined;

  return (
    // The 3D voyage needs room for the scene beside its controls; the other games read better in a narrow column.
    <div className={`mx-auto grid grid-cols-[minmax(0,1fr)] gap-6 px-4 py-10 sm:px-6 ${voyage ? "max-w-[1120px]" : "max-w-[860px]"}`}>
      <Link href="/zaidimai" className="w-fit text-sm font-semibold text-ink-2 underline underline-offset-4 hover:text-ink">
        Visi žaidimai
      </Link>
      {scenario ? (
        <Bezel>
          <ScenarioPlayer scenario={scenario} signedIn={signedIn} />
        </Bezel>
      ) : null}
      {deck ? (
        <Bezel>
          <FraudPlayer deck={deck} signedIn={signedIn} />
        </Bezel>
      ) : null}
      {voyage ? <YearSwitcher current={slug} bests={bests} /> : null}
      {voyage ? <VoyagePlayer key={slug} voyage={voyage} signedIn={signedIn} previousBest={previousBest} /> : null}
      {slug === "mokesciu-labirintas" && !TAX_RULES.reviewed ? (
        <p className="text-[13px] text-ink-2">
          Šiame žaidime naudojamas supaprastintas mokomasis mokesčių modelis. Tikslias ir aktualias taisykles tikrinkite vmi.lt ir sodra.lt.
        </p>
      ) : null}
    </div>
  );
}
