import { describe, expect, it } from "vitest";
import { InvalidPicksError } from "../errors";
import { getFraudDeck } from "./catalog";
import { scoreFraud, type FraudAnswer } from "./fraud-engine";

const deck = getFraudDeck("sukciu-medziokle")!;

function perfect(ms = 1000): FraudAnswer[] {
  return deck.items.map((i) => ({
    itemId: i.id,
    verdict: i.isScam ? "scam" : "safe",
    flagIds: i.flags.map((f) => f.id),
    ms,
  }));
}
function allWrong(): FraudAnswer[] {
  return deck.items.map((i) => ({ itemId: i.id, verdict: i.isScam ? "safe" : "scam", flagIds: [], ms: 1000 }));
}

describe("scoreFraud", () => {
  it("scores a perfect, fast run at 100% with well over 1000 points", () => {
    const r = scoreFraud(deck, perfect());
    expect(r.pct).toBe(100);
    expect(r.correct).toBe(deck.items.length);
    expect(r.total).toBe(deck.items.length);
    expect(r.points).toBeGreaterThan(1000);
  });
  it("scores an all-wrong run at zero", () => {
    expect(scoreFraud(deck, allWrong())).toMatchObject({ correct: 0, pct: 0, points: 0 });
  });
  it("gives a speed bonus that falls to zero at 15 seconds", () => {
    const fast = scoreFraud(deck, perfect(0)).points;
    const slow = scoreFraud(deck, perfect(15000)).points;
    const slower = scoreFraud(deck, perfect(60000)).points;
    expect(fast).toBeGreaterThan(slow);
    expect(slow).toBe(slower);
  });
  it("counts items that were never answered as wrong", () => {
    const r = scoreFraud(deck, perfect().slice(0, 5));
    expect(r.total).toBe(deck.items.length);
    expect(r.correct).toBe(5);
    expect(r.pct).toBe(50);
  });
  it("rewards correctly marked red flags", () => {
    const withFlags = scoreFraud(deck, perfect(15000)).points;
    const noFlags = scoreFraud(
      deck,
      perfect(15000).map((a) => ({ ...a, flagIds: [] })),
    ).points;
    expect(withFlags).toBeGreaterThan(noFlags);
  });
  it("does not let someone farm points by ticking every red flag", () => {
    const everyFlag = deck.flagOptions.map((f) => f.id);
    const spam = scoreFraud(
      deck,
      perfect(15000).map((a) => ({ ...a, flagIds: everyFlag })),
    ).points;
    const honest = scoreFraud(deck, perfect(15000)).points;
    expect(spam).toBeLessThan(honest);
  });
  it("never produces negative points", () => {
    const everyFlag = deck.flagOptions.map((f) => f.id);
    const r = scoreFraud(
      deck,
      allWrong().map((a) => ({ ...a, flagIds: everyFlag })),
    );
    expect(r.points).toBeGreaterThanOrEqual(0);
  });
});

describe("scoreFraud: tampered input", () => {
  it("rejects a duplicate item id", () => {
    const answers = perfect();
    answers.push({ ...answers[0] });
    expect(() => scoreFraud(deck, answers)).toThrow(InvalidPicksError);
  });
  it("rejects an unknown item id", () => {
    expect(() => scoreFraud(deck, [{ itemId: "nera-tokio", verdict: "scam", flagIds: [], ms: 100 }])).toThrow(InvalidPicksError);
  });
  it("rejects a verdict that is not scam or safe", () => {
    const answers = perfect() as unknown as { verdict: string }[];
    answers[0].verdict = "maybe";
    expect(() => scoreFraud(deck, answers as unknown as FraudAnswer[])).toThrow(InvalidPicksError);
  });
  it("rejects negative or non-finite times", () => {
    for (const ms of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const answers = perfect();
      answers[0].ms = ms;
      expect(() => scoreFraud(deck, answers)).toThrow(InvalidPicksError);
    }
  });
  it("rejects input that is not an array", () => {
    expect(() => scoreFraud(deck, null as unknown as FraudAnswer[])).toThrow(InvalidPicksError);
  });
  it("ignores unknown or repeated flag ids instead of crediting them", () => {
    const answers = perfect(15000);
    const first = deck.items.find((i) => i.isScam)!;
    const a = answers.find((x) => x.itemId === first.id)!;
    const base = scoreFraud(deck, answers).points;
    a.flagIds = [...a.flagIds, ...a.flagIds, "isgalvotas-požymis"];
    expect(scoreFraud(deck, answers).points).toBeLessThanOrEqual(base);
  });
});
