/** Finansinis IQ as a ring. A proper SVG circle, not a hand-drawn path. */
export function IqRing({ value }: { value: number }) {
  const v = Math.min(100, Math.max(0, Math.round(value)));
  const r = 54;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative grid size-[150px] place-items-center" role="img" aria-label={`Finansinis IQ: ${v} iš 100`}>
      <svg viewBox="0 0 130 130" className="absolute inset-0 size-full -rotate-90" aria-hidden="true">
        <circle cx="65" cy="65" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="10" />
        <circle
          cx="65"
          cy="65"
          r={r}
          fill="none"
          stroke="var(--reward)"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v / 100)}
          className="transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <div className="text-center">
        <div className="font-mono text-[34px] font-bold leading-none">{v}</div>
        <div className="mt-1 text-xs text-ink-2">Finansinis IQ</div>
      </div>
    </div>
  );
}
