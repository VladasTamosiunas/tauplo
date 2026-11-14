"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { submitRunAction } from "@/app/zaidimai/actions";
import { SaveSummary, type SaveState } from "@/components/games/GameResult";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { formatEur, formatNumber, formatPercent, pluralLt } from "@/lib/format";
import type { Voyage, Weather } from "@/lib/games/schema";
import {
  DEFAULT_PICK,
  canSailOpen,
  canUpgrade,
  depositPreview,
  incomeFor,
  initialState,
  marketOptions,
  playMonth,
  summarize,
  upgradePrice,
  type MonthPick,
  type MonthRecord,
  type VoyageState,
} from "@/lib/games/voyage-engine";
import { jarFill, type PortSlug } from "@/lib/games/voyage-scene-model";
import { VoyageCanvas, type CanvasHandle } from "./VoyageCanvas";
import { EndPanel, type PreviousBest } from "./EndPanel";
import { OutlookPanel } from "./OutlookPanel";
import { YearChart } from "./YearChart";

const WEATHER_LABEL: Record<Weather, string> = { calm: "Ramu", rough: "Bangu", storm: "Audra" };
const WEATHER_NOTE: Record<Weather, string> = {
  calm: "Atvirose mariose uždirbsi daugiau.",
  rough: "Atvirose mariose uždirbsi mažiau nei pakrantėje.",
  storm: "Atvirose mariose uždirbsi labai mažai ir teks taisyti laivą.",
};

type Phase = "plan" | "result" | "done";

const SHARES = [0, 0.1, 0.2, 0.3, 0.4, 0.5];

function Segmented({ label, value, onChange, disabled }: { label: string; value: number; onChange: (v: number) => void; disabled?: boolean }) {
  return (
    <fieldset className="grid min-w-0 gap-2" disabled={disabled}>
      <legend className="mb-1 text-sm font-semibold">{label}</legend>
      <div className="flex flex-wrap gap-1.5">
        {SHARES.map((s) => (
          <label
            key={s}
            className={`cursor-pointer rounded-md px-3 py-1.5 font-mono text-[13px] ring-1 transition-colors duration-300 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 ${
              value === s ? "bg-brand text-on-brand ring-brand" : "bg-surface text-ink-2 ring-line-2 hover:bg-surface-2"
            }`}
          >
            <input type="radio" className="sr-only" name={label} checked={value === s} onChange={() => onChange(s)} />
            {formatPercent(s * 100)}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function Toggle({ label, hint, checked, onChange, disabled }: { label: string; hint?: string; checked: boolean; onChange: (b: boolean) => void; disabled?: boolean }) {
  return (
    <label
      className={`flex items-start gap-3 rounded-lg px-3.5 py-3 ring-1 transition-colors duration-300 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 ${
        disabled ? "cursor-not-allowed opacity-55 ring-line" : "cursor-pointer ring-line-2 has-[:checked]:bg-brand-soft has-[:checked]:ring-brand"
      }`}
    >
      <input type="checkbox" className="mt-1 accent-[var(--brand)]" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="grid gap-0.5">
        <span className="text-[15px] font-semibold">{label}</span>
        {hint ? <span className="text-[13px] text-ink-2">{hint}</span> : null}
      </span>
    </label>
  );
}

function Stat({ label, value, tone, note }: { label: string; value: string; tone?: "bad" | "good"; note?: string }) {
  return (
    <div className="grid min-w-0 gap-0.5">
      <span className="text-[12px] text-ink-2">{label}</span>
      <b className={`font-mono text-[17px] font-semibold ${tone === "bad" ? "text-bad-ink" : tone === "good" ? "text-good-ink" : ""}`}>{value}</b>
      {note ? <span className="text-[11.5px] leading-tight text-ink-2">{note}</span> : null}
    </div>
  );
}

export function VoyagePlayer({ voyage, signedIn, previousBest = null }: { voyage: Voyage; signedIn: boolean; previousBest?: PreviousBest }) {
  const canvas = useRef<CanvasHandle>(null);
  const [index, setIndex] = useState(0);
  const [state, setState] = useState<VoyageState>(() => initialState(voyage));
  const [records, setRecords] = useState<MonthRecord[]>([]);
  const [picks, setPicks] = useState<MonthPick[]>([]);
  const [draft, setDraft] = useState<MonthPick>(DEFAULT_PICK);
  const [phase, setPhase] = useState<Phase>("plan");
  const [save, setSave] = useState<SaveState>({ status: "guest" });
  const [pending, start] = useTransition();
  const [announce, setAnnounce] = useState("");

  const spec = voyage.months[Math.min(index, 11)];
  const event = voyage.events[spec.event];
  const port = voyage.ports.find((p) => p.slug === spec.port)!;
  const last = records.at(-1);

  // what the player would earn this month, from the same function the engine books with
  const monthIndex = Math.min(index, 11);
  const openOk = canSailOpen(voyage, monthIndex);
  const route = draft.route === "open" && openOk ? "open" : "coast";
  const offers = marketOptions(voyage, state.gear, monthIndex, route);
  const chosen = offers.find((o) => o.port === draft.market) ?? offers.find((o) => o.home);
  const income = incomeFor(voyage, state.gear, monthIndex, route, chosen?.port);
  const price = upgradePrice(voyage, state.gear, Math.min(index, 11));
  const upgradeOk = canUpgrade(voyage, state.cash + state.cushion + income * (1 - draft.toTax - draft.toCushion), state.gear, Math.min(index, 11));
  const loanOpen = state.debt > 0;
  const split = draft.toTax + draft.toCushion + (voyage.deposit ? draft.deposit : 0);
  const over = split > 1;
  const dep = depositPreview(voyage, state, { ...draft, route }, monthIndex);
  const lockedNow = state.locked.reduce((n, d) => n + d.amount, 0);
  const nextMaturity = state.locked.length > 0 ? Math.min(...state.locked.map((d) => d.matures)) : null;

  const jars = useMemo(
    () => jarFill({ tax: state.tax, cushion: state.cushion, cash: state.cash, fixedMonthlyCost: voyage.fixedMonthlyCost, cushionTargetMonths: voyage.cushionTargetMonths }),
    [state, voyage],
  );

  const result = useMemo(() => (phase === "done" ? summarize(voyage, records, state) : null), [phase, records, state, voyage]);

  async function sailMonth() {
    const pick: MonthPick = { ...draft, toCushion: over ? Math.max(0, 1 - draft.toTax) : draft.toCushion };
    const r = playMonth(voyage, state, pick, index);
    setPicks((p) => [...p, pick]);
    setRecords((rs) => [...rs, r.record]);
    setState(r.state);
    setPhase("result");
    setAnnounce(`${spec.name}: pajamos ${formatEur(r.record.income)}, grynieji ${formatEur(r.state.cash)}.`);
    await canvas.current?.sail(r.record.market as PortSlug, 2600);
  }

  function nextMonth() {
    const nextIndex = index + 1;
    setDraft(DEFAULT_PICK);
    if (nextIndex >= voyage.months.length) {
      setIndex(nextIndex);
      setPhase("done");
      if (!signedIn) return setSave({ status: "guest" });
      setSave({ status: "saving" });
      start(async () => {
        const res = await submitRunAction(voyage.slug, picks);
        setSave(res.ok ? { status: "saved", progress: res.result } : { status: "error", message: res.error });
      });
      return;
    }
    setIndex(nextIndex);
    setPhase("plan");
  }

  function restart() {
    setIndex(0);
    setState(initialState(voyage));
    setRecords([]);
    setPicks([]);
    setDraft(DEFAULT_PICK);
    setPhase("plan");
    setSave({ status: "guest" });
  }

  const shownSeason = phase === "done" ? voyage.months[11].season : spec.season;
  const shownPort = (phase === "done" ? "klaipeda" : phase === "result" && last ? last.market : spec.port) as PortSlug;
  const shownPortName = voyage.ports.find((p) => p.slug === shownPort)?.name ?? port.name;
  // while planning the sky shows the forecast; after sailing it shows the weather that really happened,
  // so a wrong forecast is something the player can see. Frozen months keep their calm, wintry look.
  const shownWeather: Weather = phase === "done" ? "calm" : phase === "result" ? spec.weather : spec.frozen ? "calm" : spec.forecast;

  return (
    <div className="grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
      {/* sticky on phones too, as a short strip under the header: the "Plaukti" button is far below the scene, and
          a boat that sails out of sight teaches nothing */}
      <div
        className={`relative z-10 h-[220px] overflow-hidden rounded-[10px] border-t-[6px] border-bg sm:h-[300px] lg:top-20 lg:h-[min(640px,calc(100dvh-6rem))] lg:border-t-0 ${
          phase === "done" ? "lg:sticky" : "sticky top-[65px] lg:sticky"
        }`}
      >
        <VoyageCanvas
          handleRef={canvas}
          season={shownSeason}
          port={shownPort}
          gear={state.gear}
          jars={jars}
          weather={shownWeather}
          label={`Kuršių marių vaizdas: ${shownPortName}, ${spec.name}`}
        />
        <div className="pointer-events-none absolute inset-x-3 top-3 flex flex-wrap items-start justify-between gap-2">
          <div className="rounded-[10px] bg-surface/80 px-3.5 py-2 backdrop-blur-md ring-1 ring-edge">
            <div className="text-[12px] text-ink-2">{phase === "done" ? "Metai baigti" : `Mėnuo ${index + 1} iš 12`}</div>
            <div className="font-display text-[22px] font-medium leading-none">{phase === "done" ? "Gruodis" : spec.name}</div>
          </div>
          <div className="rounded-[10px] bg-surface/80 px-3.5 py-2 text-right backdrop-blur-md ring-1 ring-edge">
            <div className="text-[12px] text-ink-2">{shownPortName}</div>
            <div className="font-mono text-[13px]">
              laivas {state.gear} / {voyage.gear.maxLevel}
            </div>
          </div>
        </div>
      </div>

      <div className="min-w-0 rounded-[10px] bg-surface p-5 sm:p-6">
        <p className="sr-only" role="status" aria-live="polite">
          {announce}
        </p>

        <div className="mb-4 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4" aria-label="Pinigų indai">
          <Stat label="Kišenėje" value={formatEur(state.cash)} />
          <Stat label="Mokesčių indas" value={formatEur(state.tax)} />
          <Stat label="Pagalvė" value={formatEur(state.cushion)} tone={state.cushion >= voyage.fixedMonthlyCost * voyage.cushionTargetMonths ? "good" : undefined} />
          <Stat label="Skola" value={formatEur(state.debt)} tone={state.debt > 0 ? "bad" : undefined} />
          {lockedNow > 0 ? <Stat label="Užrakinta" value={formatEur(lockedNow)} note={nextMaturity ? `grįš ${nextMaturity} mėn.` : undefined} /> : null}
        </div>

        {phase === "plan" ? (
          <div className="grid gap-4">
            <div className="grid gap-1">
              <h3 className="text-[22px] font-medium leading-tight">
                {spec.name}, {port.name}
              </h3>
              <p className="text-[14px] text-ink-2">{port.blurb}</p>
              {index === 0 ? <p className="mt-1 text-[14.5px]">{voyage.intro}</p> : null}
            </div>

            {event.title && !event.surprise ? (
              <div className={`rounded-lg p-3.5 ring-1 ${event.scam ? "bg-bad-soft ring-bad" : "bg-reward-soft ring-reward"}`}>
                <b className="font-display text-[15px]">{event.title}</b>
                <p className="mt-0.5 text-[14px]">{event.body}</p>
              </div>
            ) : null}

            <OutlookPanel voyage={voyage} state={state} monthIndex={monthIndex} />

            <fieldset className="grid gap-2" aria-describedby="route-note">
              <legend className="mb-1 flex flex-wrap items-center gap-2 text-sm font-semibold">
                Kur plauksi?
                {openOk ? <Pill tone="plain">Prognozė: {WEATHER_LABEL[spec.forecast].toLowerCase()}</Pill> : null}
              </legend>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    ["coast", "Pakrantė", "Stabilios pajamos, jokios rizikos."],
                    ["open", "Atvirose mariose", openOk ? "Daugiau ar mažiau, kaip pasisekys su oru." : "Marios užšalusios, plaukti negalima."],
                  ] as const
                ).map(([value, title, hint]) => {
                  const off = value === "open" && !openOk;
                  return (
                    <label
                      key={value}
                      className={`grid gap-0.5 rounded-lg px-3.5 py-3 ring-1 transition-colors duration-200 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 ${
                        off ? "cursor-not-allowed opacity-55 ring-line" : "cursor-pointer ring-line-2 has-[:checked]:bg-brand-soft has-[:checked]:ring-brand"
                      }`}
                    >
                      <input type="radio" className="sr-only" name="route" disabled={off} checked={route === value} onChange={() => setDraft((d) => ({ ...d, route: value }))} />
                      <span className="text-[15px] font-semibold">{title}</span>
                      <span className="text-[12.5px] leading-snug text-ink-2">{hint}</span>
                    </label>
                  );
                })}
              </div>
              <p id="route-note" className="text-[13px] text-ink-2">
                {openOk ? WEATHER_NOTE[spec.forecast] : "Žiemą marios užšalusios, todėl pajamos tik iš pakrantės."} Prognozė ne visada išsipildo.
              </p>
            </fieldset>

            {offers.length > 0 ? (
              <fieldset className="grid gap-2" aria-describedby="market-note">
                <legend className="mb-1 text-sm font-semibold">Kur parduosi laimikį?</legend>
                <div className="grid gap-2 sm:grid-cols-3">
                  {offers.map((o) => {
                    const on = (chosen?.port ?? "") === o.port;
                    return (
                      <label
                        key={o.port}
                        className={`grid cursor-pointer gap-0.5 rounded-lg px-3.5 py-3 ring-1 transition-colors duration-200 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 ${
                          on ? "bg-brand-soft ring-brand" : "ring-line-2 hover:bg-surface-2"
                        }`}
                      >
                        <input type="radio" className="sr-only" name="market" checked={on} onChange={() => setDraft((d) => ({ ...d, market: o.home ? undefined : o.port }))} />
                        <span className="text-[15px] font-semibold">{o.name}</span>
                        <span className="whitespace-nowrap font-mono text-[13px]">{o.home ? "namie" : `kaina × ${formatNumber(o.price, 2)}`}</span>
                        <span className="text-[12.5px] leading-snug text-ink-2">
                          {o.home
                            ? `Įprasta kaina, kelionės nėra. ${formatEur(o.income)}.`
                            : o.net > 0
                              ? `Po kelionės (${formatEur(o.travelCost)}) liks ${formatEur(o.net)} daugiau.`
                              : `Po kelionės (${formatEur(o.travelCost)}) liktum ${formatEur(-o.net)} mažiau.`}
                        </span>
                      </label>
                    );
                  })}
                </div>
                <p id="market-note" className="text-[13px] text-ink-2">
                  Kainos uostuose kinta kiekvieną mėnesį. Kelionė kainuoja {formatEur(voyage.markets!.travelCost)}, todėl verta plaukti tik tada, kai kaina pakankamai aukštesnė.
                </p>
              </fieldset>
            ) : null}

            <div className={`grid gap-3 rounded-lg bg-surface-2 p-3.5 ${chosen && chosen.travelCost > 0 ? "grid-cols-3" : "grid-cols-2"}`}>
              <Stat label={route === "open" ? "Pajamos, jei orai pasitaikys tokie" : "Šio mėnesio pajamos"} value={formatEur(income)} />
              <Stat label="Pastovios išlaidos" value={formatEur(voyage.fixedMonthlyCost)} />
              {chosen && chosen.travelCost > 0 ? <Stat label="Kelionė" value={formatEur(chosen.travelCost)} /> : null}
            </div>

            <div className="grid gap-3.5">
              <Segmented label="Į mokesčių indą" value={draft.toTax} onChange={(v) => setDraft((d) => ({ ...d, toTax: v }))} />
              <Segmented label="Į pagalvę" value={draft.toCushion} onChange={(v) => setDraft((d) => ({ ...d, toCushion: v }))} />
              {dep.offered ? (
                <div className="grid gap-1.5">
                  <Segmented label="Į terminuotą indėlį" value={draft.deposit} onChange={(v) => setDraft((d) => ({ ...d, deposit: v }))} />
                  <p className="text-[13px] text-ink-2" aria-live="polite">
                    {draft.deposit === 0
                      ? `Indėlis moka daugiau nei pagalvė (${formatPercent(voyage.deposit!.monthlyRate * 100)} per mėnesį), bet pinigai užrakinti ${voyage.deposit!.termMonths} ${pluralLt(voyage.deposit!.termMonths, "mėnesį", "mėnesius", "mėnesių")} ir sąskaitų jais nesumokėsi.`
                      : dep.locked === 0
                        ? "Šį mėnesį užrakinti nieko negalima: tau reikia pinigų sąskaitoms."
                        : `Užrakinsi ${formatEur(dep.locked)}${dep.cut ? ` (prašei ${formatEur(dep.asked)}, bet sąskaitoms palieku pinigų vienam mėnesiui)` : ""}. ${dep.returnsInMonth <= 12 ? `Grįš ${dep.returnsInMonth} mėnesio pradžioje su ${formatEur(dep.interest)} palūkanų.` : `Iki metų pabaigos negrįš, bet skaičiuojasi į grynąją vertę.`}`}
                  </p>
                </div>
              ) : null}
              <p className="text-[13px] text-ink-2">
                Atidėsi <b className="font-mono">{formatEur(dep.setAside)}</b> iš {formatEur(dep.available)}. Mokesčių terminai: {voyage.taxDueMonths.length}{" "}
                {pluralLt(voyage.taxDueMonths.length, "kartas", "kartai", "kartų")} per metus.
              </p>
              {over ? (
                <p role="alert" className="text-[13px] font-medium text-bad-ink">
                  Viršijai 100 %. Pagalvei bus skirta tik likusi dalis.
                </p>
              ) : null}
            </div>

            <div className="grid gap-2">
              {price !== null ? (
                <Toggle
                  label={`Atnaujinti laivą už ${formatEur(price)}`}
                  hint={upgradeOk ? "Moka kišenės pinigais, o jei jų neužtenka, pagalve." : "Šį mėnesį neužtenka pinigų (reikia dar ir pastoviai sąskaitai)."}
                  checked={draft.upgradeGear && upgradeOk}
                  disabled={!upgradeOk}
                  onChange={(b) => setDraft((d) => ({ ...d, upgradeGear: b }))}
                />
              ) : null}
              <Toggle
                label={`Apdrausti šį mėnesį už ${formatEur(voyage.insurance.monthlyPremium)}`}
                hint={`Jei šį mėnesį ką nors reikės taisyti, draudimas padengs ${formatPercent(voyage.insurance.coverage * 100)} remonto. Nuo sukčių neapsaugo.`}
                checked={draft.insure}
                onChange={(b) => setDraft((d) => ({ ...d, insure: b }))}
              />
              <Toggle
                label={`Imti ${formatEur(voyage.loan.amount)} paskolą`}
                hint={loanOpen ? "Viena paskola jau atidaryta." : `Palūkanos ${formatPercent(voyage.loan.monthlyInterestRate * 100)} per mėnesį, grąžinama per ${voyage.loan.termMonths} mėn.`}
                checked={draft.takeLoan && !loanOpen}
                disabled={loanOpen}
                onChange={(b) => setDraft((d) => ({ ...d, takeLoan: b }))}
              />
              {event.scam ? (
                <Toggle
                  label="Atsisakyti šio pasiūlymo"
                  hint="Nepažįstamiems iš anksto pinigų nesiunčiu."
                  checked={draft.resistScam}
                  onChange={(b) => setDraft((d) => ({ ...d, resistScam: b }))}
                />
              ) : null}
            </div>

            <div>
              <Button onClick={sailMonth} arrow>
                Plaukti į {voyage.ports.find((p) => p.slug === (chosen?.port ?? spec.port))?.name ?? port.name}
              </Button>
            </div>
          </div>
        ) : null}

        {phase === "result" && last ? (
          <div className="grid gap-4" role="status">
            <h3 className="text-[22px] font-medium leading-tight">{last.name}: ataskaita</h3>
            <dl className="grid gap-1.5 text-[14.5px]">
              {[
                ["Pajamos", `+${formatEur(last.income)}`, ""],
                last.travelCost > 0 ? [`Pardavei ${voyage.ports.find((p) => p.slug === last.market)?.name ?? last.market} uoste (× ${formatNumber(last.priceMultiplier, 2)})`, `${last.marketNet >= 0 ? "+" : "−"}${formatEur(Math.abs(last.marketNet))} palyginti su namais`, last.marketNet >= 0 ? "good" : "bad"] : null,
                last.travelCost > 0 ? ["Kelionė į kitą uostą", `−${formatEur(last.travelCost)}`, ""] : null,
                last.route === "open" ? ["Oras atvirose mariose", WEATHER_LABEL[last.weather], last.weather === "storm" ? "bad" : ""] : null,
                last.weatherCost > 0 ? ["Audros padariniai laivui", `−${formatEur(last.weatherCost)}`, "bad"] : null,
                last.premium > 0 ? ["Draudimo įmoka", `−${formatEur(last.premium)}`, ""] : null,
                last.claimed > 0 ? ["Draudimas padengė", `+${formatEur(last.claimed)}`, "good"] : null,
                last.interestEarned > 0 ? ["Pagalvės palūkanos", `+${formatEur(last.interestEarned)}`, "good"] : null,
                last.maturedAmount > 0 ? ["Grįžo terminuotas indėlis", `+${formatEur(last.maturedAmount)}`, ""] : null,
                last.depositInterest > 0 ? ["Indėlio palūkanos", `+${formatEur(last.depositInterest)}`, "good"] : null,
                last.toTaxAmount + last.toCushionAmount > 0 ? ["Atidėta (mokesčiai ir pagalvė)", formatEur(last.toTaxAmount + last.toCushionAmount), ""] : null,
                last.depositedAmount > 0 ? ["Užrakinta terminuotame indėlyje", formatEur(last.depositedAmount), ""] : null,
                last.interest + last.installment > 0 ? ["Paskolos įmoka", `−${formatEur(last.interest + last.installment)}`, ""] : null,
                last.gearBought > 0 ? ["Laivo atnaujinimas", `−${formatEur(last.gearBought)}`, ""] : null,
                ["Pastovios išlaidos", `−${formatEur(last.fixedCost)}`, ""],
                last.eventCost > 0 ? [event.title, `−${formatEur(last.eventCost)}`, last.scamFell ? "bad" : ""] : null,
                last.taxDue > 0 ? ["Mokesčiai šį mėnesį", `−${formatEur(last.taxDue)}`, ""] : null,
                last.taxPenalty > 0 ? ["Baudos už nesumokėtus mokesčius", `−${formatEur(last.taxPenalty)}`, "bad"] : null,
                last.wants > 0 ? ["Nutekėjo norams", `−${formatEur(last.wants)}`, ""] : null,
                last.shortfall > 0 ? ["Pritrūko ir liko neapmokėta", formatEur(last.shortfall), "bad"] : null,
              ]
                .filter((x): x is string[] => Boolean(x))
                .map(([k, v, tone]) => (
                  <div key={k} className="flex items-baseline justify-between gap-4 border-b border-edge pb-1.5">
                    <dt className={tone === "bad" ? "font-semibold text-bad-ink" : tone === "good" ? "font-semibold text-good-ink" : "text-ink-2"}>{k}</dt>
                    <dd className={`font-mono ${tone === "bad" ? "font-semibold text-bad-ink" : tone === "good" ? "font-semibold text-good-ink" : ""}`}>{v}</dd>
                  </div>
                ))}
            </dl>
            {event.surprise && last.eventCost > 0 ? (
              <p className="rounded-lg bg-surface-2 p-3 text-[14px]">
                <b className="font-display">{event.title}.</b> {event.body}{" "}
                {last.insured ? "Draudimas padėjo, bet įmoka vis tiek sumokėta." : "Draudimo neturėjai, todėl sumokėjai visą sumą."}
              </p>
            ) : null}
            {last.route === "open" && voyage.months[index].forecast !== last.weather ? (
              <p className="rounded-lg bg-surface-2 p-3 text-[14px]">
                Prognozė žadėjo „{WEATHER_LABEL[voyage.months[index].forecast].toLowerCase()}“, bet buvo „{WEATHER_LABEL[last.weather].toLowerCase()}“. Prognozė gali klysti.
              </p>
            ) : null}
            {last.scamFell ? (
              <p className="rounded-lg bg-bad-soft p-3 text-[14px] text-bad-ink">Persiuntei pinigus nepažįstamajam ir jų nebegavai. Kitą kartą atsisakyk.</p>
            ) : null}
            <div>
              <Button onClick={nextMonth} arrow disabled={pending}>
                {index === 11 ? "Rodyti metų rezultatą" : "Kitas mėnuo"}
              </Button>
            </div>
          </div>
        ) : null}

        {phase === "done" && result ? (
          <div className="grid gap-4">
            <h3 className="text-[26px] font-medium leading-tight">
              {result.score.iq >= 75 ? "Žiemos kapitonas" : result.survivedWinter ? "Išplaukei, bet buvo ankšta" : "Žiema buvo sunki"}
            </h3>
            <div className="grid grid-cols-2 gap-3 rounded-lg bg-surface-2 p-3.5 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
              <Stat label="Finansinis IQ" value={formatNumber(result.score.iq)} />
              <Stat label="Grynoji vertė" value={formatEur(result.netWorth)} tone={result.netWorth < 0 ? "bad" : undefined} />
              <Stat label="Pagalvė" value={`${formatNumber(result.cushionMonths, 1)} mėn.`} />
            </div>
            <YearChart months={records} />
            <EndPanel voyage={voyage} result={result} picks={picks} previousBest={previousBest} />
            <ul className="grid gap-2 text-[14.5px]">
              {result.lessons.map((l) => (
                <li key={l} className="flex gap-2.5">
                  <span aria-hidden="true" className="mt-[9px] h-px w-3 shrink-0 bg-ink-2" />
                  {l}
                </li>
              ))}
            </ul>
            <SaveSummary state={save} />
            <div>
              <Button variant="ghost" onClick={restart}>
                Plaukti iš naujo
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
