import { formatEur, formatNumber, formatPercent, pluralLt } from "@/lib/format";
import type { Voyage } from "@/lib/games/schema";
import { outlookFor, type OutlookStatus } from "@/lib/games/voyage-outlook";
import type { VoyageState } from "@/lib/games/voyage-engine";

/**
 * "Kas laukia": what is coming, in words and numbers. Status is always written out, never colour alone.
 * Everything here comes from outlookFor, which plays the coming months with the engine's own rules.
 */

const STATUS_WORD: Record<OutlookStatus, string> = { covered: "Pakanka", tight: "Ankštoka", short: "Trūksta" };
const STATUS_STYLE: Record<OutlookStatus, string> = {
  covered: "bg-good-soft text-good-ink",
  tight: "bg-reward-soft text-on-reward",
  short: "bg-bad-soft text-bad-ink",
};

function Tag({ status }: { status: OutlookStatus }) {
  return <span className={`rounded-full px-2.5 py-0.5 text-[12px] font-medium ${STATUS_STYLE[status]}`}>{STATUS_WORD[status]}</span>;
}

const monthsWord = (n: number) => `${n} ${pluralLt(n, "mėnuo", "mėnesiai", "mėnesių")}`;

export function OutlookPanel({ voyage, state, monthIndex }: { voyage: Voyage; state: VoyageState; monthIndex: number }) {
  const o = outlookFor(voyage, state, monthIndex);
  const dueName = o.tax.dueMonth ? voyage.months[o.tax.dueMonth - 1].name.toLowerCase() : null;
  const leanName = o.winter.firstLeanMonth ? voyage.months[o.winter.firstLeanMonth - 1].name.toLowerCase() : null;

  return (
    <section aria-labelledby="outlook-h" className="grid gap-3 rounded-lg bg-surface-2 p-3.5">
      <h4 id="outlook-h" className="font-display text-[14px] font-semibold">
        Kas laukia
      </h4>

      <dl className="grid gap-3 text-[14px]">
        {dueName ? (
          <div className="grid gap-0.5">
            <dt className="flex flex-wrap items-center justify-between gap-2">
              <span>
                Mokesčiai {o.tax.monthsAway === 0 ? "šį mėnesį" : `už ${monthsWord(o.tax.monthsAway)}`}, {dueName}
              </span>
              <Tag status={o.tax.status} />
            </dt>
            <dd className="text-[13px] text-ink-2">
              Jau skolingas <b className="font-mono text-ink">{formatEur(o.tax.owed)}</b>, inde yra{" "}
              <b className="font-mono text-ink">{formatEur(o.tax.inJar)}</b>.
              {o.tax.gap > 0
                ? ` Trūkstamos ${formatEur(o.tax.gap)} imsime iš kišenės ir pridėsime ${formatPercent(o.tax.penaltyRate * 100)} baudą.`
                : " Terminas bus padengtas."}
            </dd>
          </div>
        ) : null}

        {leanName ? (
          <div className="grid gap-0.5">
            <dt className="flex flex-wrap items-center justify-between gap-2">
              <span>
                Skurūs mėnesiai {o.winter.monthsAway === 0 ? "prasideda dabar" : `po ${monthsWord(o.winter.monthsAway)}`}, nuo {leanName}
              </span>
              <Tag status={o.winter.status} />
            </dt>
            <dd className="text-[13px] text-ink-2">
              Iki jų pabaigos išlaidų numatyta <b className="font-mono text-ink">{formatEur(o.winter.cost)}</b>, uždarbio apie{" "}
              <b className="font-mono text-ink">{formatEur(o.winter.expectedIncome)}</b>.
              {o.winter.gap > 0
                ? ` Jei nieko nekeisi, sąskaitoms pritrūks ${formatEur(o.winter.gap)}.`
                : o.winter.status === "tight"
                  ? " Išgyvensi, bet pabaigoje liks mažiau nei mėnesio išlaidų."
                  : " Su dabartiniais pinigais išgyvensi."}
            </dd>
          </div>
        ) : null}

        <div className="flex flex-wrap items-baseline justify-between gap-2 border-t border-line pt-2.5">
          <dt>Pinigų užtenka</dt>
          <dd className="font-mono text-[14px]">{formatNumber(o.runwayMonths, 1)} mėn. išlaidų</dd>
        </div>
      </dl>

      <p className="text-[12px] text-ink-2">Skaičiuota pakrantės maršrutu. Oro ir netikėtų įvykių niekas nežino, todėl jų čia nėra.</p>
    </section>
  );
}
