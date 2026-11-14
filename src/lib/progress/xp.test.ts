import { describe, expect, it } from "vitest";
import { levelFromXp, xpForLevel } from "./xp";

describe("xpForLevel", () => {
  it("level 1, 2, 3 start at 0, 100, 300 XP", () => {
    expect(xpForLevel(1)).toBe(0);
    expect(xpForLevel(2)).toBe(100);
    expect(xpForLevel(3)).toBe(300);
  });
});

describe("levelFromXp", () => {
  it("starts at level 1 with zero progress", () => {
    expect(levelFromXp(0)).toEqual({ level: 1, xpIntoLevel: 0, xpForNext: 100, progress: 0 });
  });
  it("150 XP is level 2, 50 XP in, of 200", () => {
    const r = levelFromXp(150);
    expect(r.level).toBe(2);
    expect(r.xpIntoLevel).toBe(50);
    expect(r.xpForNext).toBe(200);
    expect(r.progress).toBeCloseTo(0.25, 6);
  });
  it("exactly on a boundary moves up a level", () => {
    expect(levelFromXp(100).level).toBe(2);
    expect(levelFromXp(99).level).toBe(1);
  });
  it("treats negative XP as zero", () => {
    expect(levelFromXp(-50).level).toBe(1);
  });
});
