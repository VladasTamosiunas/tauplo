import type { MonthRecord } from "@/lib/games/voyage-engine";
import { formatEur } from "@/lib/format";

/**
 * The year in one picture: the pocket, the tax jar and the cushion at the end of every month, on a single
 * euro axis. Cushion and cash are the two lines that matter, so they are drawn solid; the tax jar is dashed.
 * Series are labelled at their right-hand end, and a table below carries the same numbers for screen readers.
 */

const W = 560;
const H = 230;
const PAD = { l: 62, r: 92, t: 14, b: 26 };
const SHORT = ["Sau", "Vas", "Kov", "Bal", "Geg", "Bir", "Lie", "Rgp", "Rgs", "Spa", "Lap", "Gru"];

type Series = { key: "cash" | "tax" | "cushion"; label: string; color: string; dash?: string };

const SERIES: Series[] = [
  { key: "cushion", label: "Pagalvė", color: "var(--chart)" },
  { key: "cash", label: "Kišenė", color: "var(--ink)" },
  { key: "tax", label: "Mokesčiai", color: "var(--ink-2)", dash: "5 4" },
];

function niceTop(max: number): number {
  const m = Math.max(max, 100);
  const mag = Math.pow(10, Math.floor(Math.log10(m)));
  for (const c of [1, 2, 2.5, 5, 10]) if (c * mag >= m) return c * mag;
  return 10 * mag;
}

export function YearChart({ months }: { months: MonthRecord[] }) {
  if (months.length === 0) return null;
  const top = niceTop(Math.max(...months.flatMap((m) => [m.cash, m.tax, m.cushion])));
  const pw = W - PAD.l - PAD.r;
  const ph = H - PAD.t - PAD.b;
  const n = months.length;
  const X = (i: number) => PAD.l + (n === 1 ? 0 : (i / (n - 1)) * pw);
  const Y = (v: number) => PAD.t + ph - (v / top) * ph;
  const path = (key: Series["key"]) => months.map((m, i) => `${i ? "L" : "M"}${X(i).toFixed(1)} ${Y(m[key]).toFixed(1)}`).join("");

  // labels at the right end, nudged apart so two close endpoints never overprint
  const ends = SERIES.map((s) => ({ s, y: Y(months[n - 1][s.key]) })).sort((a, b) => a.y - b.y);
  for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 14) ends[i].y = ends[i - 1].y + 14;

  const ticks = [0, 0.5, 1].map((k) => k * top);
  const taxMonths = months.map((m, i) => (m.taxDue > 0 ? i : -1)).filter((i) => i >= 0);
  const shortMonths = months.map((m, i) => (m.shortfall > 0 ? i : -1)).filter((i) => i >= 0);

  return (
    <figure className="grid gap-2">
      <figcaption className="text-[13px] text-ink-2">Pinigai kiekvieno mėnesio pabaigoje</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Kišenės, mokesčių indo ir pagalvės dydis per metus" className="block h-auto w-full">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={Y(t)} y2={Y(t)} stroke="var(--line)" strokeWidth={1} />
            <text x={PAD.l - 8} y={Y(t) + 4} textAnchor="end" fill="var(--ink-2)" fontSize={11} fontFamily="var(--font-mono)">
              {formatEur(t)}
            </text>
          </g>
        ))}
        {taxMonths.map((i) => (
          <line key={`t${i}`} x1={X(i)} x2={X(i)} y1={PAD.t} y2={PAD.t + ph} stroke="var(--line-2)" strokeWidth={1} strokeDasharray="2 3" />
        ))}
        {SERIES.map((s) => (
          <path key={s.key} d={path(s.key)} fill="none" stroke={s.color} strokeWidth={s.key === "cushion" ? 2.5 : 1.75} strokeDasharray={s.dash} strokeLinejoin="round" strokeLinecap="round" />
        ))}
        {shortMonths.map((i) => (
          <circle key={`s${i}`} cx={X(i)} cy={Y(months[i].cash)} r={4.5} fill="var(--bad)" stroke="var(--surface)" strokeWidth={2} />
        ))}
        {months.map((_, i) =>
          i % 2 === 0 || i === n - 1 ? (
            <text key={i} x={X(i)} y={H - 8} textAnchor={i === n - 1 ? "end" : "middle"} fill="var(--ink-2)" fontSize={11} fontFamily="var(--font-mono)">
              {SHORT[i]}
            </text>
          ) : null,
        )}
        {ends.map(({ s, y }) => (
          <text key={s.key} x={W - PAD.r + 8} y={y + 4} fill="var(--ink)" fontSize={12} fontWeight={s.key === "cushion" ? 600 : 400}>
            {s.label}
          </text>
        ))}
      </svg>
      <p className="text-[12.5px] text-ink-2">
        Punktyrinės linijos žymi mokesčių terminus.
        {shortMonths.length > 0 ? " Raudonas taškas rodo mėnesį, kai pritrūko pinigų sąskaitoms." : ""}
      </p>
      <details className="text-[13px] text-ink-2">
        <summary className="cursor-pointer font-medium text-ink">Rodyti lentelę</summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[320px] text-left font-mono text-[12.5px]">
            <caption className="sr-only">Pinigai kiekvieno mėnesio pabaigoje</caption>
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className="py-1.5 pr-3 font-medium">Mėnuo</th>
                <th scope="col" className="py-1.5 pr-3 text-right font-medium">Kišenė</th>
                <th scope="col" className="py-1.5 pr-3 text-right font-medium">Mokesčių indas</th>
                <th scope="col" className="py-1.5 text-right font-medium">Pagalvė</th>
              </tr>
            </thead>
            <tbody>
              {months.map((m, i) => (
                <tr key={m.month} className="border-b border-line last:border-0">
                  <th scope="row" className="py-1.5 pr-3 font-normal">{SHORT[i]}</th>
                  <td className="py-1.5 pr-3 text-right">{formatEur(m.cash)}</td>
                  <td className="py-1.5 pr-3 text-right">{formatEur(m.tax)}</td>
                  <td className="py-1.5 text-right">{formatEur(m.cushion)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
