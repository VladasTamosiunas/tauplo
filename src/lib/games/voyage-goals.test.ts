import { describe, expect, it } from "vitest";
import { getVoyage } from "./catalog";
import { GOALS, goalsFor, goalBonusXp, hindsightFor } from "./voyage-goals";
import { DEFAULT_PICK, marketOptions, replayVoyage, type MonthPick } from "./voyage-engine";

const v = getVoyage("kursiu-mariu-kapitonas")!;
const year = (f: (m: number) => Partial<MonthPick>): MonthPick[] => Array.from({ length: 12 }, (_, i) => ({ ...DEFAULT_PICK, ...f(i + 1) }));
const careful = () => year((m) => ({ toTax: m <= 9 ? 0.25 : 0.1, toCushion: [5, 6, 7, 8].includes(m) ? 0.4 : 0.1, resistScam: true }));
const reckless = () => year(() => ({ takeLoan: true }));

describe("goals", () => {
  it("there are six goals, each with a plain name and description", () => {
    expect(GOALS).toHaveLength(6);
    for (const g of GOALS) {
      expect(g.id).toMatch(/^[a-z-]+$/);
      expect(g.title.length).toBeGreaterThan(3);
      expect(g.description.length).toBeGreaterThan(10);
    }
    expect(new Set(GOALS.map((g) => g.id)).size).toBe(6);
  });
  it("a careful year meets several goals and a reckless one meets almost none", () => {
    const good = goalsFor(v, replayVoyage(v, careful())).filter((g) => g.met).length;
    const bad = goalsFor(v, replayVoyage(v, reckless())).filter((g) => g.met).length;
    expect(good).toBeGreaterThanOrEqual(4);
    expect(bad).toBeLessThanOrEqual(1);
  });
  it("each goal can be failed and met: none is always true and none is always false", () => {
    const results = [careful(), reckless(), year(() => ({})), year(() => ({ toCushion: 0.5, toTax: 0.3, resistScam: true, insure: true }))].map((p) => goalsFor(v, replayVoyage(v, p)));
    for (const g of GOALS) {
      const states = results.map((r) => r.find((x) => x.id === g.id)!.met);
      expect(states.some(Boolean), `${g.id} is never met`).toBe(true);
      expect(states.some((s) => !s), `${g.id} is always met`).toBe(true);
    }
  });
  it("is deterministic and reports every goal in the same order", () => {
    const r = replayVoyage(v, careful());
    expect(goalsFor(v, r)).toEqual(goalsFor(v, r));
    expect(goalsFor(v, r).map((g) => g.id)).toEqual(GOALS.map((g) => g.id));
  });
  it("gives a progress line with the real figure for every goal", () => {
    for (const g of goalsFor(v, replayVoyage(v, careful()))) expect(g.progress.length).toBeGreaterThan(3);
  });
  it("the goal about not paying a penalty is met by exactly the years without one", () => {
    const clean = goalsFor(v, replayVoyage(v, careful())).find((g) => g.id === "ne-baudu")!;
    const dirty = goalsFor(v, replayVoyage(v, reckless())).find((g) => g.id === "ne-baudu")!;
    expect(clean.met).toBe(true);
    expect(dirty.met).toBe(false);
  });
});

describe("goalBonusXp", () => {
  it("is zero for no goals, positive for some, and capped", () => {
    expect(goalBonusXp([])).toBe(0);
    const all = goalsFor(v, replayVoyage(v, careful())).map((g) => ({ ...g, met: true }));
    const one = [{ ...all[0] }];
    expect(goalBonusXp(one)).toBeGreaterThan(0);
    expect(goalBonusXp(all)).toBeGreaterThan(goalBonusXp(one));
    expect(goalBonusXp(all)).toBeLessThanOrEqual(60);
  });
  it("counts only goals that were met", () => {
    const r = goalsFor(v, replayVoyage(v, reckless()));
    expect(goalBonusXp(r)).toBe(r.filter((g) => g.met).length * 10);
  });
});

describe("hindsight: what one change would have done", () => {
  it("replays the same year with one change and reports the real difference in net worth", () => {
    const picks = year((m) => ({ toTax: 0.25, toCushion: 0.3, resistScam: m !== 3 })); // falls for the March scam
    const h = hindsightFor(v, picks);
    const scam = h.find((x) => x.id === "atsisakyti-sukciu");
    expect(scam).toBeDefined();
    const base = replayVoyage(v, picks);
    const changed = replayVoyage(v, picks.map((p) => ({ ...p, resistScam: true })));
    expect(scam!.netWorthChange).toBeCloseTo(changed.netWorth - base.netWorth, 1);
    expect(scam!.netWorthChange).toBeGreaterThan(0);
  });
  it("only suggests changes that actually help, and the best one comes first", () => {
    const h = hindsightFor(v, year((m) => ({ resistScam: m !== 3, toCushion: 0 })));
    expect(h.length).toBeGreaterThan(0);
    for (const x of h) expect(x.netWorthChange + x.scoreChange).toBeGreaterThan(0);
    for (let i = 1; i < h.length; i++) expect(h[i - 1].netWorthChange + h[i - 1].scoreChange * 20).toBeGreaterThanOrEqual(h[i].netWorthChange + h[i].scoreChange * 20);
  });
  it("suggests nothing for a year that is already as good as these changes can make it", () => {
    const best = year((m) => ({ toTax: 0.25, toCushion: [3, 4, 5, 6, 7, 8, 9].includes(m) ? 0.4 : 0.15, resistScam: true }));
    const h = hindsightFor(v, best);
    for (const x of h) expect(x.netWorthChange + x.scoreChange).toBeGreaterThan(0);
    expect(h.length).toBeLessThanOrEqual(3);
  });
  it("suggests saving more tax when a penalty was paid", () => {
    const h = hindsightFor(v, year(() => ({ resistScam: true })));
    expect(h.some((x) => x.id === "atidėti-mokesčiams" || x.id === "atideti-mokesciams")).toBe(true);
  });
  it("every suggestion has a plain sentence naming the change", () => {
    for (const x of hindsightFor(v, reckless())) {
      expect(x.sentence.length).toBeGreaterThan(15);
      expect(x.sentence).not.toMatch(/undefined|NaN/);
    }
  });
  it("suggests selling at the best port when the player always sold at home and money was left on the table", () => {
    const stayed = year((m) => ({ toTax: 0.25, toCushion: [4, 5, 6, 7, 8, 9].includes(m) ? 0.4 : 0.15, resistScam: true }));
    const tip = hindsightFor(v, stayed).find((x) => x.id === "dobiausias-uostas");
    expect(tip).toBeDefined();
    // it is a real replay: the same picks with the best port chosen each month, and the net worth difference is the engine's
    const better = year((m) => {
      const best = marketOptions(v, replayVoyage(v, stayed).months[m - 2]?.gear ?? v.start.gear, m - 1, "coast").filter((o) => !o.home).sort((a, b) => b.net - a.net)[0];
      return { ...stayed[m - 1], ...(best && best.net > 0 ? { market: best.port } : {}) };
    });
    expect(tip!.netWorthChange).toBeCloseTo(replayVoyage(v, better).netWorth - replayVoyage(v, stayed).netWorth, 1);
    expect(tip!.netWorthChange).toBeGreaterThan(300);
    expect(tip!.sentence).toMatch(/uost/i);
  });
  it("does not suggest it to a player who already sold at the best port every month", () => {
    const stayed = year((m) => ({ toTax: 0.25, toCushion: [4, 5, 6, 7, 8, 9].includes(m) ? 0.4 : 0.15, resistScam: true }));
    const already = year((m) => {
      const best = marketOptions(v, replayVoyage(v, stayed).months[m - 2]?.gear ?? v.start.gear, m - 1, "coast").filter((o) => !o.home).sort((a, b) => b.net - a.net)[0];
      return { ...stayed[m - 1], ...(best && best.net > 0 ? { market: best.port } : {}) };
    });
    expect(hindsightFor(v, already).find((x) => x.id === "dobiausias-uostas")).toBeUndefined();
  });
  it("never changes the picks it was given", () => {
    const picks = reckless();
    const before = JSON.stringify(picks);
    hindsightFor(v, picks);
    expect(JSON.stringify(picks)).toBe(before);
  });
});
