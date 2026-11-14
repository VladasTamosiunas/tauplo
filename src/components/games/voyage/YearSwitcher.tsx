import Link from "next/link";
import { VOYAGE_YEARS } from "@/lib/games/voyage-years";

/**
 * Four years, easiest to hardest. A row of links (each year is its own page and its own saved best),
 * with the level shown as plain words and filled marks so it does not rely on colour.
 */

const LEVEL_WORD = ["", "Lengvas", "Vidutinis", "Sunkus", "Rizikingas"] as const;

export function YearSwitcher({ current, bests }: { current: string; bests?: Record<string, number | null> }) {
  return (
    <nav aria-label="Pasirink metus" className="grid gap-2">
      {/* one scrolling row on a phone (four stacked cards pushed the scene below the fold), a grid from tablet up */}
      <ul className="relative -mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-4">
        {VOYAGE_YEARS.map((y) => {
          const active = y.slug === current;
          const best = bests?.[y.slug] ?? null;
          return (
            <li key={y.slug} className="w-[172px] shrink-0 snap-start sm:w-auto">
              <Link
                href={`/zaidimai/${y.slug}`}
                aria-current={active ? "page" : undefined}
                className={`grid h-full gap-1 rounded-lg p-3 ring-1 transition-colors duration-200 ease-snap sm:p-3.5 ${
                  active ? "bg-brand-soft ring-brand" : "bg-surface ring-line-2 hover:bg-surface-2"
                }`}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="font-display text-[15px] font-semibold">{y.name}</span>
                  <span className="font-mono text-[12px] text-ink-2" aria-hidden="true">
                    {"■".repeat(y.level)}
                    {"□".repeat(4 - y.level)}
                  </span>
                </span>
                <span className="text-[12.5px] text-ink-2">
                  {LEVEL_WORD[y.level]}
                  {best !== null ? `, tavo geriausias ${best}` : ""}
                  <span className="sr-only">{active ? ". Dabar pasirinkti metai." : ""}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
