import type { ReactNode } from "react";

export type PillTone = "xp" | "level1" | "level2" | "cert" | "good" | "bad" | "plain";

/*
  Tags are small sentence-case labels on a pale tint, as in a printed index. The XP reward is the one
  amber pill. Colour carries meaning only: amber for reward, green/coral for feedback, grey for the rest.
*/
const tones: Record<PillTone, string> = {
  xp: "bg-reward-soft text-on-reward font-mono font-semibold",
  level1: "bg-surface-2 text-ink",
  level2: "bg-surface-2 text-ink",
  cert: "text-ink-2 ring-1 ring-inset ring-line-2",
  good: "bg-good-soft text-good-ink",
  bad: "bg-bad-soft text-bad-ink",
  plain: "bg-surface-2 text-ink-2",
};

export function Pill({ tone = "plain", children, className = "" }: { tone?: PillTone; children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[12px] font-medium leading-5 ${tones[tone]} ${className}`}>
      {children}
    </span>
  );
}
