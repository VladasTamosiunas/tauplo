import type { ReactNode } from "react";

/** One of the three game HUD meters. `value` is 0 to 1 and animates with a transform. */
export function Meter({
  label,
  display,
  value,
  tone,
}: {
  label: string;
  display: ReactNode;
  value: number;
  tone: "brand" | "stress" | "stressHot" | "reward";
}) {
  const fill = { brand: "bg-brand", stress: "bg-ink-2", stressHot: "bg-bad", reward: "bg-reward" }[tone];
  const v = Math.min(1, Math.max(0.02, value));
  return (
    <div className="grid min-w-0 gap-1.5">
      <div className="flex items-baseline justify-between gap-1.5 text-[12.5px] text-ink-2">
        <span>{label}</span>
        <b className="font-mono text-[15px] font-semibold text-ink">{display}</b>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full border border-line bg-surface-2">
        <div
          className={`h-full w-full origin-left rounded-full transition-transform duration-500 ease-out ${fill}`}
          style={{ transform: `scaleX(${v})` }}
        />
      </div>
    </div>
  );
}
