import { formatEur, formatNumber } from "@/lib/format";
import type { Voyage } from "@/lib/games/schema";
import type { MonthPick, VoyageResult } from "@/lib/games/voyage-engine";
import { goalBonusXp, goalsFor, hindsightFor } from "@/lib/games/voyage-goals";

/**
 * The part of the year-end screen that gives the player something to do next: goals with their real
 * figures, what one change would have done (a real replay), and how this year compares with their best.
 */

export type PreviousBest = { iq: number; eur: number } | null;

/** A tip and a lesson about the same thing would say it twice, so a tip is skipped when a lesson already covers its topic. */
const TOPIC: Record<string, RegExp> = {
  "apsidrausti-pavojingus-menesius": /draud/i,
  "atsisakyti-sukciu": /sukč/i,
  "atideti-mokesciams": /mokesč.*baud|baud.*mokesč/i,
  "ne-paskola": /paskol/i,
};

export function EndPanel({ voyage, result, picks, previousBest }: { voyage: Voyage; result: VoyageResult; picks: MonthPick[]; previousBest: PreviousBest }) {
  const goals = goalsFor(voyage, result);
  const met = goals.filter((g) => g.met).length;
  const tips = (picks.length === voyage.months.length ? hindsightFor(voyage, picks) : [])
    .filter((t) => !(TOPIC[t.id] && result.lessons.some((l) => TOPIC[t.id].test(l))))
    .slice(0, 2);
  const bonus = goalBonusXp(goals);

  const beat = previousBest ? result.score.iq > previousBest.iq || (result.score.iq === previousBest.iq && result.netWorth > previousBest.eur) : null;

  return (
    <div className="grid gap-5">
      {previousBest === null ? null : (
        <p className="rounded-lg bg-surface-2 p-3 text-[14px]" role="status">
          {beat ? (
            <>
              <b className="font-display">Naujas rekordas.</b> Ankstesnis geriausias: balas {formatNumber(previousBest.iq)}, grynoji vertė{" "}
              <span className="font-mono">{formatEur(previousBest.eur)}</span>.
            </>
          ) : (
            <>
              Tavo geriausias rezultatas šiais metais: balas {formatNumber(previousBest.iq)}, grynoji vertė{" "}
              <span className="font-mono">{formatEur(previousBest.eur)}</span>.
            </>
          )}
        </p>
      )}

      <section aria-labelledby="goals-h" className="grid gap-2.5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h4 id="goals-h" className="font-display text-[15px] font-semibold">
            Tikslai: {met} iš {goals.length}
          </h4>
          {bonus > 0 ? <span className="font-mono text-[12.5px] text-on-reward">+{bonus} XP už tikslus</span> : null}
        </div>
        <ul className="grid gap-1.5">
          {goals.map((g) => (
            <li key={g.id} className="grid grid-cols-[auto_1fr] items-baseline gap-x-2.5 text-[14px]">
              <span aria-hidden="true" className={`font-mono text-[13px] ${g.met ? "text-good-ink" : "text-ink-2"}`}>
                {g.met ? "[x]" : "[ ]"}
              </span>
              <span>
                <span className={g.met ? "font-medium" : "text-ink-2"}>
                  {g.title}
                  <span className="sr-only">{g.met ? ", įvykdyta" : ", neįvykdyta"}</span>
                </span>
                <span className="block text-[12.5px] text-ink-2">{g.progress}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      {tips.length > 0 ? (
        <section aria-labelledby="what-if-h" className="grid gap-2">
          <h4 id="what-if-h" className="font-display text-[15px] font-semibold">
            Ką pakeitus būtų geriau
          </h4>
          <ul className="grid gap-2 text-[14px]">
            {tips.map((t) => (
              <li key={t.id} className="flex gap-2.5">
                <span aria-hidden="true" className="mt-[9px] h-px w-3 shrink-0 bg-ink-2" />
                {t.sentence}
              </li>
            ))}
          </ul>
          <p className="text-[12px] text-ink-2">Kiekvienas pakeitimas apskaičiuotas iš tikrųjų, perleidus tuos pačius metus iš naujo.</p>
        </section>
      ) : null}
    </div>
  );
}
