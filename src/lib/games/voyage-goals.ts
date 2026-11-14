import { formatEur, formatNumber } from "../format";
import type { Voyage } from "./schema";
import { marketOptions, replayVoyage, type MonthPick, type VoyageResult } from "./voyage-engine";

/**
 * Things to aim for after a first good score, and a way to see what one change would have done.
 * Pure functions of the engine's own result, so the browser, the server and the tests all agree.
 */

export type GoalDef = { id: string; title: string; description: string };
export type GoalResult = GoalDef & { met: boolean; /** The real figure behind the verdict, in words. */ progress: string };

export const GOALS: GoalDef[] = [
  { id: "zieme-be-skolu-saskaitoms", title: "Žiema be neapmokėtų sąskaitų", description: "Visus skurius mėnesius sumokėk visas sąskaitas." },
  { id: "pagalve-iki-tikslo", title: "Pagalvė pasiekė tikslą", description: "Metų pabaigoje pagalvės užtenka tiek mėnesių, kiek rodo tikslas." },
  { id: "ne-baudu", title: "Jokių mokesčių baudų", description: "Kiekvieną mokesčių terminą padenk iš mokesčių indo." },
  { id: "nei-vieno-sukcio", title: "Nė vieno sukčiaus", description: "Atsisakyk kiekvieno per gražaus pasiūlymo." },
  { id: "be-palukanu", title: "Be palūkanų už paskolą", description: "Neimk paskolos arba pasirūpink, kad jos nereikėtų." },
  { id: "pagalve-uzdirba", title: "Pagalvė uždirba", description: "Palaikyk pagalvę visus metus, kad ji sukauptų bent 40 € palūkanų." },
];

export function goalsFor(v: Voyage, r: VoyageResult): GoalResult[] {
  const t = r.totals;
  const lean = v.months.filter((m) => m.season < 0.3).length;
  const leanOk = r.months.filter((m, i) => v.months[i].season < 0.3 && m.shortfall === 0).length;
  const verdicts: Record<string, [boolean, string]> = {
    "zieme-be-skolu-saskaitoms": [r.survivedWinter, `${leanOk} iš ${lean} skurių mėnesių be neapmokėtų sąskaitų`],
    "pagalve-iki-tikslo": [r.cushionMonths >= v.cushionTargetMonths, `${formatNumber(r.cushionMonths, 1)} iš ${formatNumber(v.cushionTargetMonths)} mėn.`],
    "ne-baudu": [t.taxPenalty === 0, t.taxPenalty === 0 ? "baudų nebuvo" : `baudų sumokėta ${formatEur(t.taxPenalty)}`],
    "nei-vieno-sukcio": [t.scamsFell === 0, `${t.scamsFaced - t.scamsFell} iš ${t.scamsFaced} pasiūlymų atmesta`],
    "be-palukanu": [t.interest === 0, t.interest === 0 ? "palūkanų nemokėta" : `palūkanoms išleista ${formatEur(t.interest)}`],
    "pagalve-uzdirba": [t.interestEarned >= 40, `pagalvė uždirbo ${formatEur(t.interestEarned)} iš 40 €`],
  };
  return GOALS.map((g) => ({ ...g, met: verdicts[g.id][0], progress: verdicts[g.id][1] }));
}

/** Experience for goals met: a small, capped reward. The server recomputes it, it is never read from the client. */
export const GOAL_XP = 10;
export function goalBonusXp(goals: Pick<GoalResult, "met">[]): number {
  return Math.min(60, goals.filter((g) => g.met).length * GOAL_XP);
}

export type Hindsight = {
  id: string;
  /** Plain Lithuanian sentence naming the change and its effect. */
  sentence: string;
  netWorthChange: number;
  scoreChange: number;
};

type Change = { id: string; apply: (p: MonthPick[], v: Voyage) => MonthPick[]; applies: (p: MonthPick[], v: Voyage) => boolean; say: (net: number, score: number) => string };

const money = (n: number) => formatEur(Math.abs(Math.round(n)));
const gain = (net: number) => (net > 0 ? `būtum turėjęs ${money(net)} daugiau` : "rezultatas nesikeistų");

const CHANGES: Change[] = [
  {
    id: "atsisakyti-sukciu",
    applies: () => true,
    apply: (p) => p.map((x) => ({ ...x, resistScam: true })),
    say: (net) => `Jei būtum atsisakęs visų per gražių pasiūlymų, ${gain(net)}.`,
  },
  {
    id: "atideti-mokesciams",
    applies: () => true,
    apply: (p) => p.map((x) => ({ ...x, toTax: Math.max(x.toTax, 0.25) })),
    say: (net, score) => `Jei kiekvieną mėnesį mokesčiams būtum atidėjęs bent ketvirtį pajamų, ${gain(net)}${score > 0 ? ` ir balas būtų ${score} didesnis` : ""}.`,
  },
  {
    id: "daugiau-i-pagalve",
    applies: () => true,
    apply: (p) => p.map((x, i) => ({ ...x, toCushion: Math.min(0.5, Math.max(x.toCushion, i >= 3 && i <= 8 ? 0.4 : 0.15)) })),
    say: (net, score) => `Jei vasarą į pagalvę būtum dėjęs 40 % pajamų, ${gain(net)}${score > 0 ? ` ir balas būtų ${score} didesnis` : ""}.`,
  },
  {
    id: "ne-paskola",
    applies: (p) => p.some((x) => x.takeLoan),
    apply: (p) => p.map((x) => ({ ...x, takeLoan: false })),
    say: (net) => `Jei nebūtum ėmęs paskolos, ${gain(net)}.`,
  },
  {
    id: "mazesnis-laivo-kelias",
    applies: (p) => p.some((x) => x.route === "open"),
    apply: (p) => p.map((x) => ({ ...x, route: "coast" as const })),
    say: (net) => `Jei visus mėnesius būtum plaukęs pakrante, ${gain(net)}.`,
  },
  {
    id: "dobiausias-uostas",
    // offered to a player who sold at home every month, in a voyage that has markets
    applies: (p, v) => Boolean(v.markets) && p.every((x) => x.market === undefined),
    apply: (p, v) => {
      // choose each month the port with the biggest gain after the trip, at the boat the player really had that month
      const played = replayVoyage(v, p);
      return p.map((x, i) => {
        const gear = i === 0 ? v.start.gear : played.months[i - 1].gear;
        const best = marketOptions(v, gear, i, x.route === "open" && !v.months[i].frozen ? "open" : "coast").filter((o) => !o.home).sort((a, b) => b.net - a.net)[0];
        return best && best.net > 0 ? { ...x, market: best.port } : x;
      });
    },
    say: (net) => `Jei kiekvieną mėnesį būtum pardavęs tame uoste, kuriame kaina buvo aukščiausia, ${gain(net)}, net sumokėjęs už keliones.`,
  },
  {
    id: "apsidrausti-pavojingus-menesius",
    applies: (p) => p.every((x) => !x.insure),
    apply: (p) => p.map((x, i) => ({ ...x, insure: i === 8 || i === 9 })),
    say: (net) => `Jei prieš rudens gedimus būtum apsidraudęs porą mėnesių, ${gain(net)}.`,
  },
];

/**
 * Replays the same year with one change at a time and keeps the changes that would have helped, best first.
 * Each result is a real replay by the engine, not an estimate.
 */
export function hindsightFor(v: Voyage, picks: MonthPick[]): Hindsight[] {
  const base = replayVoyage(v, picks);
  const out: Hindsight[] = [];
  for (const c of CHANGES) {
    if (!c.applies(picks, v)) continue;
    const alt = replayVoyage(v, c.apply(picks.map((p) => ({ ...p })), v));
    const netWorthChange = Math.round((alt.netWorth - base.netWorth) * 100) / 100;
    const scoreChange = alt.score.iq - base.score.iq;
    if (netWorthChange + scoreChange <= 0) continue;
    out.push({ id: c.id, sentence: c.say(netWorthChange, scoreChange), netWorthChange, scoreChange });
  }
  return out.sort((a, b) => b.netWorthChange + b.scoreChange * 20 - (a.netWorthChange + a.scoreChange * 20));
}
