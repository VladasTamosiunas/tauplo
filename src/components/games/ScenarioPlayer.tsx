"use client";

import { useEffect, useRef, useState } from "react";
import { submitRunAction } from "@/app/zaidimai/actions";
import { SaveSummary, type SaveState } from "@/components/games/GameResult";
import { Button } from "@/components/ui/Button";
import { Meter } from "@/components/ui/Meter";
import { formatEur, formatNumber, formatSigned } from "@/lib/format";
import { applyEffects, resolveStep, type Meters, type StepOutcome } from "@/lib/games/scenario-engine";
import type { Scenario } from "@/lib/games/schema";
import { parseAmount } from "@/lib/parse";

type Props = {
  scenario: Scenario;
  signedIn: boolean;
  /** Demo mode: short, nothing is saved, and the end screen points to the full game. */
  demo?: boolean;
  fullGameHref?: string;
};

export function ScenarioPlayer({ scenario, signedIn, demo = false, fullGameHref }: Props) {
  const [index, setIndex] = useState(0);
  const [meters, setMeters] = useState<Meters>({ ...scenario.start });
  const [picks, setPicks] = useState<(number)[]>([]);
  const [outcomes, setOutcomes] = useState<StepOutcome[]>([]);
  const [current, setCurrent] = useState<StepOutcome | null>(null);
  const [pickedIndex, setPickedIndex] = useState<number | null>(null);
  const [amount, setAmount] = useState("");
  const [amountError, setAmountError] = useState("");
  const [save, setSave] = useState<SaveState>({ status: "guest" });
  const nextRef = useRef<HTMLButtonElement>(null);

  const finished = index >= scenario.steps.length;
  const step = scenario.steps[index];

  useEffect(() => {
    if (current) nextRef.current?.focus({ preventScroll: true });
  }, [current]);

  function commit(pick: number) {
    const r = resolveStep(step, pick);
    setPicks((p) => [...p, pick]);
    setOutcomes((o) => [...o, { stepId: step.id, ...r }]);
    setMeters((m) => applyEffects(m, r.effects));
    setCurrent({ stepId: step.id, ...r });
  }

  async function advance() {
    const nextIndex = index + 1;
    setCurrent(null);
    setPickedIndex(null);
    setAmount("");
    setAmountError("");
    setIndex(nextIndex);
    if (nextIndex < scenario.steps.length) return;
    if (demo) return setSave({ status: "demo" });
    if (!signedIn) return setSave({ status: "guest" });
    setSave({ status: "saving" });
    const res = await submitRunAction(scenario.slug, picks);
    setSave(res.ok ? { status: "saved", progress: res.result } : { status: "error", message: res.error });
  }

  function restart() {
    setIndex(0);
    setMeters({ ...scenario.start });
    setPicks([]);
    setOutcomes([]);
    setCurrent(null);
    setPickedIndex(null);
    setAmount("");
    setSave({ status: "guest" });
  }

  const hud = (
    <div className="grid grid-cols-1 gap-3.5 border-b border-line px-5 pb-5 pt-4 sm:grid-cols-3 sm:px-6" aria-label="Žaidimo rodikliai">
      <Meter label={scenario.hud.eur} display={formatEur(meters.eur)} value={meters.eur / scenario.eurMax} tone="brand" />
      <Meter
        label={scenario.hud.stress}
        display={`${Math.round(meters.stress)} %`}
        value={meters.stress / 100}
        tone={meters.stress >= 60 ? "stressHot" : "stress"}
      />
      <Meter label={scenario.hud.iq} display={Math.round(meters.iq)} value={meters.iq / 100} tone="reward" />
    </div>
  );

  return (
    <div className="min-w-0 overflow-hidden rounded-[10px]">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-5 pt-5 sm:px-6">
        <h2 className="text-xl font-bold">{scenario.title}</h2>
        <span className="text-[13px] text-ink-2">{finished ? "Žaidimas baigtas" : `Dilema ${index + 1} iš ${scenario.steps.length}`}</span>
      </div>
      {hud}

      <div className="grid gap-[18px] p-5 sm:p-6">
        {finished ? (
          <div className="grid gap-4">
            <h3 className="text-[22px] font-bold">{meters.iq >= 90 ? "Puikiai, budrus detektyve" : "Dar yra kur augti"}</h3>
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {[
                [scenario.hud.eur, formatEur(meters.eur)],
                [scenario.hud.stress, `${Math.round(meters.stress)} %`],
                [scenario.hud.iq, formatNumber(Math.round(meters.iq))],
              ].map(([k, v]) => (
                <div key={k} className="rounded-lg border border-line p-3">
                  <dt className="text-[12.5px] text-ink-2">{k}</dt>
                  <dd className="font-mono text-[22px] font-bold">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="text-sm text-ink-2">
              Teisingai atsakei į {outcomes.filter((o) => o.tone === "good").length} iš {outcomes.length} dilemų.
            </p>
            <SaveSummary state={save} fullGameHref={fullGameHref} />
            <div>
              <Button variant="ghost" onClick={restart}>
                Žaisti iš naujo
              </Button>
            </div>
          </div>
        ) : (
          <>
            {index === 0 && !current ? <p className="text-[15px] text-ink-2">{scenario.intro}</p> : null}
            <h3 className="text-[22px] font-bold leading-tight">{step.title}</h3>

            {step.type === "choice" && step.kind === "sms" ? (
              <div className="max-w-[46ch] rounded-[6px_18px_18px_18px] border border-line bg-surface-2 px-4 py-3.5 text-[15px]">
                <small className="mb-1 block text-xs text-ink-2">SMS · {step.sender ?? "Nežinomas numeris"}</small>
                {step.body}
                {step.link ? (
                  <>
                    {" "}
                    <u className="break-all underline-offset-[3px]">{step.link}</u>
                  </>
                ) : null}
              </div>
            ) : (
              <p className="max-w-[56ch] text-base">{step.body}</p>
            )}

            {step.type === "choice" ? (
              <div className="grid gap-2.5" role="group" aria-label="Pasirinkimai">
                {step.choices.map((c, k) => {
                  const picked = current !== null && pickedIndex === k;
                  const tone = picked ? { good: "border-good bg-good-soft", mid: "border-line-2 bg-surface-2", bad: "border-bad bg-bad-soft" }[c.tone] : "border-line-2 bg-surface";
                  return (
                    <button
                      key={c.label}
                      type="button"
                      disabled={current !== null}
                      onClick={() => {
                        setPickedIndex(k);
                        commit(k);
                      }}
                      className={`rounded-lg border px-4 py-3.5 text-left text-[15px] font-semibold leading-snug transition active:translate-y-px ${tone} ${
                        current === null ? "hover:border-brand hover:bg-brand-soft" : picked ? "" : "text-ink-2"
                      }`}
                    >
                      {c.label}
                    </button>
                  );
                })}
              </div>
            ) : (
              <form
                className="grid gap-3"
                noValidate
                onSubmit={(e) => {
                  e.preventDefault();
                  if (current) return;
                  const v = parseAmount(amount);
                  if (v === null) return setAmountError("Įrašykite sumą eurais, pavyzdžiui, 1 250,50.");
                  setAmountError("");
                  commit(v);
                }}
              >
                <p className="rounded-lg bg-surface-2 p-3 text-sm text-ink-2">{step.hint}</p>
                <div className="grid max-w-[320px] gap-1.5">
                  <label htmlFor="amount" className="text-sm font-semibold">
                    Tavo atsakymas, €
                  </label>
                  <input
                    id="amount"
                    inputMode="decimal"
                    autoComplete="off"
                    value={amount}
                    disabled={current !== null}
                    onChange={(e) => setAmount(e.target.value)}
                    aria-invalid={amountError ? true : undefined}
                    aria-describedby={amountError ? "amount-err" : undefined}
                    className={`rounded-lg border bg-surface px-3 py-[11px] font-mono text-lg ${amountError ? "border-bad" : "border-line-2"}`}
                  />
                  {amountError ? (
                    <p id="amount-err" role="alert" className="text-[13px] font-medium text-bad-ink">
                      {amountError}
                    </p>
                  ) : null}
                </div>
                {current === null ? (
                  <div>
                    <Button type="submit">Patikrinti</Button>
                  </div>
                ) : null}
              </form>
            )}

            {current ? (
              <div
                role="status"
                className={`grid gap-2.5 rounded-lg border p-4 ${
                  { good: "border-good bg-good-soft", mid: "border-line bg-surface-2", bad: "border-bad bg-bad-soft" }[current.tone]
                }`}
              >
                <strong className={`font-display text-[15px] ${current.tone === "good" ? "text-good-ink" : current.tone === "bad" ? "text-bad-ink" : ""}`}>
                  {{ good: "Išmintingas sprendimas", mid: "Priimtina, bet galima geriau", bad: "Brangus sprendimas" }[current.tone]}
                </strong>
                <p>{current.note}</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    [scenario.hud.eur, formatSigned(current.effects.eur, " €")],
                    [scenario.hud.stress, formatSigned(current.effects.stress, " %")],
                    [scenario.hud.iq, formatSigned(current.effects.iq)],
                  ].map(([k, v]) => (
                    <span key={k} className="rounded-full border border-line-2 bg-surface px-[9px] py-1 font-mono text-[12.5px] font-semibold">
                      {k} {v}
                    </span>
                  ))}
                </div>
                <div>
                  <Button
                    ref={nextRef}
                    onClick={advance}
                    size="sm"
                    arrow
                  >
                    {index === scenario.steps.length - 1 ? "Rodyti rezultatą" : "Toliau"}
                  </Button>
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
