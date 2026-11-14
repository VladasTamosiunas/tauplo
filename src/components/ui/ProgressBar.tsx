export function ProgressBar({
  value,
  max,
  label,
  tone = "good",
}: {
  value: number;
  max: number;
  label: string;
  tone?: "good" | "reward" | "brand";
}) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const fill = tone === "reward" ? "bg-reward" : "bg-brand";
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      className="h-2 overflow-hidden rounded-full border border-line bg-surface-2"
    >
      <div className={`h-full rounded-full ${fill}`} style={{ width: `${pct}%` }} />
    </div>
  );
}
