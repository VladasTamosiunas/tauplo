"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { projectBalance } from "@/lib/calc/compound";
import { formatEur, formatNumber, formatPercent, formatSigned } from "@/lib/format";

const RATES = [
  { value: 0, label: "Banko sąskaita", note: "Pinigai saugūs, bet neauga. Kainoms kylant, jų perkamoji galia mažėja." },
  { value: 3.5, label: "Terminuotas indėlis", note: "Mažiau rizikos ir nuspėjamas augimas." },
  { value: 8, label: "Indeksų fondas", note: "Didesnė tikėtina grąža, bet vertė svyruoja. 8 % yra pavyzdinė prielaida, ne pažadas." },
] as const;

const MONTHS = 60;
const H = 220;
const PAD = { l: 62, r: 20, t: 16, b: 28 };

function niceStep(top: number): number {
  const raw = top / 4;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  for (const c of [1, 2, 2.5, 5, 10]) if (c * mag >= raw) return c * mag;
  return 10 * mag;
}

export function CompoundCalculator() {
  const uid = useId();
  const [monthly, setMonthly] = useState(120);
  const [rate, setRate] = useState<(typeof RATES)[number]["value"]>(3.5);
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  // Draw at the real container width so axis text keeps its size on phones instead of shrinking with the SVG.
  const [W, setW] = useState(460);
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const read = () => setW(Math.max(260, Math.round(el.clientWidth)));
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const series = useMemo(() => projectBalance(monthly, rate, MONTHS), [monthly, rate]);
  const base = useMemo(() => projectBalance(monthly, 0, MONTHS), [monthly]);
  // The scale always fits the 8 % case, so the gap between choices stays visible while switching.
  const top = useMemo(() => projectBalance(monthly, 8, MONTHS)[MONTHS], [monthly]);

  const step = niceStep(top);
  const yMax = step * 4;
  const pw = W - PAD.l - PAD.r;
  const ph = H - PAD.t - PAD.b;
  const X = (k: number) => PAD.l + (k / MONTHS) * pw;
  const Y = (v: number) => PAD.t + ph - (v / yMax) * ph;
  const path = (arr: number[]) => arr.map((v, k) => `${k ? "L" : "M"}${X(k).toFixed(1)} ${Y(v).toFixed(1)}`).join("");

  const final = series[MONTHS];
  const paid = monthly * MONTHS;
  const growth = Math.round(final - paid);
  const info = RATES.find((r) => r.value === rate)!;

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const box = svgRef.current?.getBoundingClientRect();
    if (!box) return;
    const x = ((e.clientX - box.left) / box.width) * W;
    setHover(Math.min(MONTHS, Math.max(0, Math.round(((x - PAD.l) / pw) * MONTHS))));
  }

  return (
    <section aria-labelledby={`${uid}-t`} className="min-w-0 p-5 sm:p-8">
      <h3 id={`${uid}-t`} className="mb-[18px] text-lg font-bold">
        Penkerių metų įpročio skaičiuoklė
      </h3>

      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={`${uid}-amt`} className="text-sm font-semibold">
          Kiek atidėsi per mėnesį
        </label>
        <output htmlFor={`${uid}-amt`} className="font-mono text-xl font-semibold">
          {formatEur(monthly)}
        </output>
      </div>
      <input
        id={`${uid}-amt`}
        type="range"
        min={10}
        max={500}
        step={5}
        value={monthly}
        onChange={(e) => setMonthly(Number(e.target.value))}
        className="range my-2.5 mb-5 h-7 w-full"
        style={{ ["--fill" as string]: `${((monthly - 10) / 490) * 100}%` }}
      />

      <fieldset className="mb-5 min-w-0 border-0 p-0">
        <legend className="mb-2 p-0 text-sm font-semibold">Kur laikysi pinigus</legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {RATES.map((r) => (
            <label
              key={r.value}
              className="relative grid cursor-pointer gap-0.5 rounded-lg border border-line-2 bg-surface px-3 py-2.5 transition has-[:checked]:border-brand has-[:checked]:bg-brand-soft has-[:checked]:shadow-[inset_0_0_0_1px_var(--brand)] has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2"
            >
              <input
                type="radio"
                name={`${uid}-rate`}
                value={r.value}
                checked={rate === r.value}
                onChange={() => setRate(r.value)}
                className="absolute inset-0 cursor-pointer opacity-0"
              />
              <span className="font-mono text-[17px] font-semibold">{formatPercent(r.value, r.value % 1 ? 1 : 0)}</span>
              <span className="text-[12.5px] leading-snug text-ink-2">{r.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-wrap items-end justify-between gap-x-5 gap-y-2.5 border-t border-line pt-4">
        <div>
          <div className="text-[13px] text-ink-2">Po 5 metų turėsi</div>
          <div className="font-mono text-[clamp(30px,4vw,40px)] font-bold leading-[1.05]" aria-live="polite">
            {formatEur(final)}
          </div>
        </div>
        <div className="grid gap-1 text-right text-[13.5px] text-ink-2">
          <span>
            Tavo įnašai <b className="font-mono font-semibold text-ink">{formatEur(paid)}</b>
          </span>
          <span>
            Palūkanos ir augimas <b className="font-mono font-semibold text-chart">{formatSigned(growth, " €")}</b>
          </span>
        </div>
      </div>
      <p className="mt-3 min-h-[2.9em] text-[13.5px] text-ink-2">{info.note}</p>

      <div ref={boxRef} className="relative mt-1.5">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={`Sukaupta suma per penkerius metus: ${formatEur(final)} iš ${formatEur(paid)} įnašų`}
          className="block h-[220px] w-full touch-pan-y"
          onPointerMove={onMove}
          onPointerDown={onMove}
          onPointerLeave={() => setHover(null)}
        >
          {[0, 1, 2, 3, 4].map((t) => (
            <g key={t}>
              <line x1={PAD.l} x2={W - PAD.r} y1={Y(step * t)} y2={Y(step * t)} stroke="var(--line)" strokeWidth={1} />
              <text x={PAD.l - 8} y={Y(step * t) + 4} textAnchor="end" fill="var(--ink-2)" fontSize={11} fontFamily="var(--font-mono)">
                {formatEur(step * t)}
              </text>
            </g>
          ))}
          {[0, 1, 2, 3, 4, 5].map((yr) => (
            <text
              key={yr}
              x={X(yr * 12)}
              y={H - 8}
              textAnchor={yr === 0 ? "start" : "middle"}
              fill="var(--ink-2)"
              fontSize={11}
              fontFamily="var(--font-mono)"
            >
              {yr === 0 ? "0" : `${yr} m.`}
            </text>
          ))}
          <path d={`${path(series)}L${X(MONTHS)} ${Y(0)}L${X(0)} ${Y(0)}Z`} fill="var(--chart)" opacity={0.12} />
          {rate > 0 ? <path d={path(base)} fill="none" stroke="var(--ink-2)" strokeWidth={1.5} strokeDasharray="5 4" /> : null}
          <path d={path(series)} fill="none" stroke="var(--chart)" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
          <circle cx={X(MONTHS)} cy={Y(final)} r={5} fill="var(--chart)" stroke="var(--surface)" strokeWidth={2} />
          {hover !== null ? (
            <g>
              <line x1={X(hover)} x2={X(hover)} y1={PAD.t} y2={PAD.t + ph} stroke="var(--ink-2)" strokeWidth={1} />
              <circle cx={X(hover)} cy={Y(series[hover])} r={5} fill="var(--chart)" stroke="var(--surface)" strokeWidth={2} />
              {rate > 0 ? <circle cx={X(hover)} cy={Y(base[hover])} r={4} fill="var(--ink-2)" stroke="var(--surface)" strokeWidth={2} /> : null}
            </g>
          ) : null}
        </svg>
        {hover !== null ? (
          <div
            className="pointer-events-none absolute top-1.5 whitespace-nowrap rounded-lg bg-ink px-2.5 py-2 font-mono text-xs leading-[1.45] text-bg"
            style={{ left: `clamp(0px, calc(${(X(hover) / W) * 100}% - 60px), calc(100% - 140px))` }}
          >
            <b>{hover} mėn.</b>
            <br />
            {rate > 0 ? "Su augimu " : "Suma "}
            {formatEur(series[hover])}
            {rate > 0 ? (
              <>
                <br />
                Tik įnašai {formatEur(base[hover])}
              </>
            ) : null}
          </div>
        ) : null}
      </div>

      <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5 text-[12.5px] text-ink-2" aria-label="Grafiko žymėjimas">
        <li className="flex items-center gap-2">
          <svg width="22" height="8" viewBox="0 0 22 8" aria-hidden="true">
            <line x1="1" y1="4" x2="21" y2="4" stroke="var(--chart)" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
          {rate > 0 ? `${info.label}, ${formatPercent(rate, rate % 1 ? 1 : 0)}` : "Įnašai ir sąskaita, 0 %"}
        </li>
        {rate > 0 ? (
          <li className="flex items-center gap-2">
            <svg width="22" height="8" viewBox="0 0 22 8" aria-hidden="true">
              <line x1="1" y1="4" x2="21" y2="4" stroke="var(--ink-2)" strokeWidth="1.5" strokeDasharray="5 4" />
            </svg>
            Tik tavo įnašai
          </li>
        ) : null}
        <li className="ml-auto font-mono">Ašis: metai</li>
      </ul>

      <table className="sr-only">
        <caption>Sukaupta suma pagal metus</caption>
        <thead>
          <tr>
            <th>Metai</th>
            <th>Įnašai</th>
            <th>Suma</th>
          </tr>
        </thead>
        <tbody>
          {[1, 2, 3, 4, 5].map((y) => (
            <tr key={y}>
              <td>{formatNumber(y)}</td>
              <td>{formatEur(monthly * 12 * y)}</td>
              <td>{formatEur(series[y * 12])}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="mt-3.5 text-[12.5px] leading-normal text-ink-2">
        Iliustracinis skaičiavimas: palūkanos kapitalizuojamos kas mėnesį, mokesčiai neįtraukti. Fondo grąža negarantuojama, vertė gali ir kristi.
      </p>
    </section>
  );
}
