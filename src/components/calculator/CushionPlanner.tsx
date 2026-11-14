"use client";

import Link from "next/link";
import { useId, useMemo, useState, useTransition } from "react";
import { saveCushionPlanAction } from "@/app/skaiciuokle/actions";
import { SaveSummary, type SaveState } from "@/components/games/GameResult";
import { Button } from "@/components/ui/Button";
import { monthsToCushion } from "@/lib/calc/cushion";
import { formatEur, pluralLt } from "@/lib/format";
import { parseAmount } from "@/lib/parse";

type Initial = { monthlyExpenses: number; currentSavings: number; monthlySaving: number; months: number } | null;

function AmountField({ id, label, value, onChange, hint }: { id: string; label: string; value: string; onChange: (v: string) => void; hint?: string }) {
  const bad = value.trim() !== "" && parseAmount(value) === null;
  return (
    <div className="grid min-w-0 content-start gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      <input
        id={id}
        inputMode="decimal"
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={bad ? true : undefined}
        aria-describedby={`${id}-hint`}
        className={`w-full min-w-0 rounded-lg border bg-surface px-3 py-[11px] font-mono text-lg ${bad ? "border-bad" : "border-line-2"}`}
      />
      <p id={`${id}-hint`} className={`text-[13px] ${bad ? "font-medium text-bad-ink" : "text-ink-2"}`}>
        {bad ? "Įrašykite sumą eurais, pavyzdžiui, 900 arba 1 250,50." : hint}
      </p>
    </div>
  );
}

/** Emergency-fund planner. Works for guests; saves for signed-in learners. */
export function CushionPlanner({ signedIn, initial }: { signedIn: boolean; initial: Initial }) {
  const uid = useId();
  const [expenses, setExpenses] = useState(String(initial?.monthlyExpenses ?? 900));
  const [savings, setSavings] = useState(String(initial?.currentSavings ?? 0));
  const [saving, setSaving] = useState(String(initial?.monthlySaving ?? 300));
  const [target, setTarget] = useState(initial?.months ?? 3);
  const [state, setState] = useState<SaveState>({ status: "demo" });
  const [pending, start] = useTransition();

  const e = parseAmount(expenses);
  const s = parseAmount(savings);
  const m = parseAmount(saving);
  const valid = e !== null && s !== null && m !== null && e > 0;

  const plan = useMemo(
    () => (valid ? { goal: e * target, months: monthsToCushion({ monthlyExpenses: e, currentSavings: s, monthlySaving: m, targetMonths: target }) } : null),
    [valid, e, s, m, target],
  );

  function save() {
    if (!valid) return;
    start(async () => {
      setState({ status: "saving" });
      const r = await saveCushionPlanAction({ monthlyExpenses: e, currentSavings: s, monthlySaving: m, targetMonths: target });
      setState(r.ok ? { status: "saved", progress: r.progress } : { status: "error", message: r.error });
    });
  }

  return (
    <section aria-labelledby={`${uid}-t`} className="min-w-0 p-5 sm:p-8">
      <h3 id={`${uid}-t`} className="mb-1 text-lg font-bold">
        Pagalvės nenumatytoms išlaidoms planas
      </h3>
      <p className="mb-5 text-sm text-ink-2">Sužinok, kiek pinigų reikia atsargoms ir per kiek mėnesių jas susikaupsi.</p>

      <div className="grid gap-x-4 gap-y-5 sm:grid-cols-2">
        <AmountField id={`${uid}-e`} label="Būtinosios išlaidos per mėnesį, €" value={expenses} onChange={setExpenses} hint="Būstas, maistas, kelionės, sąskaitos." />
        <AmountField id={`${uid}-s`} label="Jau sukaupta, €" value={savings} onChange={setSavings} />
        <AmountField id={`${uid}-m`} label="Atidėsi per mėnesį, €" value={saving} onChange={setSaving} />
        <div className="grid min-w-0 content-start gap-1.5">
          <label htmlFor={`${uid}-n`} className="text-sm font-semibold">
            Tikslas, mėnesių išlaidų
          </label>
          <select
            id={`${uid}-n`}
            value={target}
            onChange={(ev) => setTarget(Number(ev.target.value))}
            className="w-full min-w-0 rounded-lg border border-line-2 bg-surface px-3 py-[11px] text-[15px]"
          >
            {[1, 2, 3, 4, 5, 6, 9, 12].map((n) => (
              <option key={n} value={n}>
                {n} {pluralLt(n, "mėnuo", "mėnesiai", "mėnesių")}
              </option>
            ))}
          </select>
          <p className="text-[13px] text-ink-2">Dažna rekomendacija: nuo 3 iki 6 mėnesių.</p>
        </div>
      </div>

      <div className="mt-5 rounded-lg border border-line bg-surface-2 p-4" aria-live="polite">
        {plan ? (
          <div className="grid gap-1">
            <div className="text-[13px] text-ink-2">Tavo tikslas</div>
            <div className="font-mono text-[28px] font-bold leading-tight">{formatEur(plan.goal)}</div>
            <p className="text-[15px]">
              {plan.months === 0
                ? "Pagalvė jau sukaupta. Puikus rezultatas."
                : plan.months === null
                  ? "Su nuline mėnesine suma tikslo nepasieksi. Įrašyk, kiek gali atidėti kas mėnesį."
                  : `Tikslą pasieksi maždaug per ${plan.months} ${pluralLt(plan.months, "mėnesį", "mėnesius", "mėnesių")}.`}
            </p>
          </div>
        ) : (
          <p className="text-sm text-ink-2">Įrašyk būtinąsias išlaidas, ir parodysime, kiek pagalvei reikia.</p>
        )}
      </div>

      <div className="mt-4 grid gap-3">
        {signedIn ? (
          <div>
            <Button onClick={save} disabled={!valid || pending}>
              {pending ? "Saugoma..." : "Išsaugoti planą"}
            </Button>
          </div>
        ) : (
          <p className="text-sm text-ink-2">
            <Link href="/registruotis" className="font-semibold underline">
              Susikurk paskyrą
            </Link>
            , kad išsaugotum planą ir gautum ženklelį „Pagalvės architektas“, kai planuosi bent 3 mėnesių pagalvę.
          </p>
        )}
        {state.status !== "demo" ? <SaveSummary state={state} /> : null}
      </div>
    </section>
  );
}
