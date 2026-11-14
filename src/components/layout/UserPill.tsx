import { Pill } from "@/components/ui/Pill";
import { formatNumber } from "@/lib/format";

/** Streak and XP preview for signed-in learners. The streak hides on the narrowest screens to keep the bar on one line. */
export function UserPill({ xp, streak }: { xp: number; streak: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {streak > 0 ? (
        <span className="hidden sm:inline-flex">
          <Pill tone="xp">{streak} d. serija</Pill>
        </span>
      ) : null}
      <Pill tone="xp">{formatNumber(xp)}&nbsp;XP</Pill>
    </div>
  );
}
