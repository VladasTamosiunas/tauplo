"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { submitRunAction } from "@/app/zaidimai/actions";
import { SaveSummary, type SaveState } from "@/components/games/GameResult";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { formatNumber } from "@/lib/format";
import { SPEED_WINDOW_MS, scoreFraud, type FraudAnswer } from "@/lib/games/fraud-engine";
import type { FraudDeck } from "@/lib/games/schema";

const CHANNEL: Record<string, string> = { sms: "SMS žinutė", email: "El. laiškas", ad: "Reklama" };

export function FraudPlayer({ deck, signedIn }: { deck: FraudDeck; signedIn: boolean }) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<FraudAnswer[]>([]);
  const [ticked, setTicked] = useState<string[]>([]);
  const [verdict, setVerdict] = useState<"scam" | "safe" | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const [msLeft, setMsLeft] = useState(SPEED_WINDOW_MS);
  const [save, setSave] = useState<SaveState>({ status: "guest" });
  const startedAt = useRef<number>(0);
  const nextRef = useRef<HTMLButtonElement>(null);

  const finished = index >= deck.items.length;
  const item = deck.items[index];
  const answered = verdict !== null || timedOut;

  const decide = useCallback(
    (v: "scam" | "safe") => {
      if (answered || finished) return;
      const ms = Math.min(SPEED_WINDOW_MS * 4, Math.round(performance.now() - startedAt.current));
      setVerdict(v);
      setAnswers((a) => [...a, { itemId: deck.items[index].id, verdict: v, flagIds: ticked, ms }]);
    },
    [answered, finished, deck.items, index, ticked],
  );

  // 15 s countdown per item. When it runs out the item counts as unanswered (wrong).
  // The clock starts when the effect starts and every state update happens in the timer callback,
  // so the bar shows the full 15 s at first and nothing is set synchronously inside the effect.
  useEffect(() => {
    if (finished || answered) return;
    startedAt.current = performance.now();
    const id = window.setInterval(() => {
      const left = SPEED_WINDOW_MS - (performance.now() - startedAt.current);
      if (left <= 0) {
        window.clearInterval(id);
        setMsLeft(0);
        setTimedOut(true);
      } else setMsLeft(left);
    }, 100);
    return () => window.clearInterval(id);
  }, [index, finished, answered]);

  useEffect(() => {
    if (answered) nextRef.current?.focus({ preventScroll: true });
  }, [answered]);

  async function next() {
    const nextIndex = index + 1;
    setIndex(nextIndex);
    setVerdict(null);
    setTimedOut(false);
    setTicked([]);
    setMsLeft(SPEED_WINDOW_MS); // the bar starts full for the next item
    if (nextIndex < deck.items.length) return;
    if (!signedIn) return setSave({ status: "guest" });
    setSave({ status: "saving" });
    const res = await submitRunAction(deck.slug, answers);
    setSave(res.ok ? { status: "saved", progress: res.result } : { status: "error", message: res.error });
  }

  function restart() {
    setIndex(0);
    setMsLeft(SPEED_WINDOW_MS);
    setAnswers([]);
    setTicked([]);
    setVerdict(null);
    setTimedOut(false);
    setSave({ status: "guest" });
  }

  const score = finished ? scoreFraud(deck, answers) : null;
  const correct = verdict !== null && (verdict === "scam") === item?.isScam;

  return (
    <div className="min-w-0 overflow-hidden rounded-[10px]">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-5 pt-5 sm:px-6">
        <h2 className="text-xl font-bold">{deck.title}</h2>
        <span className="text-[13px] text-ink-2">{finished ? "Žaidimas baigtas" : `Pranešimas ${index + 1} iš ${deck.items.length}`}</span>
      </div>

      <div className="grid gap-[18px] p-5 sm:p-6">
        {finished && score ? (
          <div className="grid gap-4">
            <h3 className="text-[22px] font-bold">{score.pct >= 80 ? "Puikus akylumas" : "Dar yra kur augti"}</h3>
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {[
                ["Teisingi atsakymai", `${score.correct} / ${score.total}`],
                ["Tikslumas", `${score.pct} %`],
                ["Taškai", formatNumber(score.points)],
              ].map(([k, v]) => (
                <div key={k} className="rounded-lg border border-line p-3">
                  <dt className="text-[12.5px] text-ink-2">{k}</dt>
                  <dd className="font-mono text-[22px] font-bold">{v}</dd>
                </div>
              ))}
            </dl>
            <SaveSummary state={save} />
            <div>
              <Button variant="ghost" onClick={restart}>
                Žaisti iš naujo
              </Button>
            </div>
          </div>
        ) : (
          <>
            {index === 0 && !answered ? <p className="text-[15px] text-ink-2">{deck.intro}</p> : null}

            <div
              className="h-1.5 overflow-hidden rounded-full bg-surface-2"
              role="progressbar"
              aria-label="Likęs laikas"
              aria-valuemin={0}
              aria-valuemax={15}
              aria-valuenow={Math.ceil(msLeft / 1000)}
            >
              <div
                className={`h-full rounded-full ${msLeft < 4000 ? "bg-bad" : "bg-brand"}`}
                style={{ width: `${(msLeft / SPEED_WINDOW_MS) * 100}%` }}
              />
            </div>

            <article className="grid gap-2 rounded-lg border border-line bg-surface-2 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-2">
                <span>{CHANNEL[item.channel]}</span>
                <span className="break-all font-mono">{item.sender}</span>
              </div>
              {item.subject ? <h3 className="text-base font-bold">{item.subject}</h3> : null}
              <p className="text-[15px]">{item.body}</p>
            </article>

            {!answered ? (
              <>
                <fieldset className="grid gap-2">
                  <legend className="mb-1 text-sm font-semibold">Kas tave įspėjo? (nebūtina)</legend>
                  <div className="flex flex-wrap gap-2">
                    {deck.flagOptions.map((f) => {
                      const on = ticked.includes(f.id);
                      return (
                        <label
                          key={f.id}
                          className={`cursor-pointer rounded-full border px-3 py-1.5 text-[13.5px] has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 ${
                            on ? "border-brand bg-brand-soft font-semibold" : "border-line-2 bg-surface"
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="sr-only"
                            checked={on}
                            onChange={() => setTicked((t) => (on ? t.filter((x) => x !== f.id) : [...t, f.id]))}
                          />
                          {f.label}
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => decide("scam")}
                    className="rounded-lg border border-bad bg-bad-soft px-4 py-3.5 font-semibold text-bad-ink active:translate-y-px"
                  >
                    Tai sukčiai
                  </button>
                  <button
                    type="button"
                    onClick={() => decide("safe")}
                    className="rounded-lg border border-good bg-good-soft px-4 py-3.5 font-semibold text-good-ink active:translate-y-px"
                  >
                    Atrodo tikra
                  </button>
                </div>
              </>
            ) : (
              <div
                role="status"
                className={`grid gap-2.5 rounded-lg border p-4 ${correct ? "border-good bg-good-soft" : "border-bad bg-bad-soft"}`}
              >
                <strong className={`font-display text-[15px] ${correct ? "text-good-ink" : "text-bad-ink"}`}>
                  {timedOut && verdict === null ? "Laikas baigėsi" : correct ? "Teisingai" : "Neteisingai"}
                </strong>
                <p>
                  {item.isScam ? "Tai buvo sukčiavimas. " : "Tai buvo tikras pranešimas. "}
                  {item.explain}
                </p>
                {item.flags.length > 0 ? (
                  <ul className="grid gap-1 text-sm">
                    {item.flags.map((f) => (
                      <li key={f.id} className="flex flex-wrap gap-x-2">
                        <Pill tone="plain">{deck.flagOptions.find((o) => o.id === f.id)?.label}</Pill>
                        <span>{f.text}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <div>
                  <Button
                    ref={nextRef}
                    onClick={next}
                    size="sm"
                    arrow
                  >
                    {index === deck.items.length - 1 ? "Rodyti rezultatą" : "Toliau"}
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
