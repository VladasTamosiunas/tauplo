import { BADGES } from "@/lib/progress/badges";

/** Earned badges are filled; locked ones show how to earn them. */
export function BadgeGrid({ earned }: { earned: string[] }) {
  const have = new Set(earned);
  return (
    <ul className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(min(100%,220px),1fr))]">
      {BADGES.map((b) => {
        const on = have.has(b.slug);
        return (
          <li
            key={b.slug}
            className={`grid content-start gap-1 rounded-lg border p-4 ${on ? "border-reward bg-reward-soft" : "border-line bg-surface"}`}
          >
            <b className={`font-display text-[15px] ${on ? "text-on-reward" : "text-ink-2"}`}>
              {b.name}
              <span className="sr-only">{on ? " (gautas)" : " (dar negautas)"}</span>
            </b>
            <span className={`text-[13px] ${on ? "text-on-reward" : "text-ink-2"}`}>{b.description}</span>
            {on ? null : <span className="mt-1 text-xs font-semibold text-ink-2">Dar negautas</span>}
          </li>
        );
      })}
    </ul>
  );
}
