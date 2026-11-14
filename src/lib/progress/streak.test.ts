import { describe, expect, it } from "vitest";
import { nextStreak, vilniusDateKey } from "./streak";

describe("vilniusDateKey", () => {
  it("uses Vilnius time (UTC+3 in summer): 21:30 UTC is already the next day", () => {
    expect(vilniusDateKey(new Date("2025-06-30T21:30:00Z"))).toBe("2025-07-01");
  });
  it("uses UTC+2 in winter: 21:30 UTC is still the same day", () => {
    expect(vilniusDateKey(new Date("2025-01-15T21:30:00Z"))).toBe("2025-01-15");
  });
  it("UTC+2 in winter: 22:30 UTC is the next day", () => {
    expect(vilniusDateKey(new Date("2025-01-15T22:30:00Z"))).toBe("2025-01-16");
  });
});

describe("nextStreak", () => {
  it("first ever activity starts a streak of 1", () => {
    expect(nextStreak({ count: 0, lastKey: null }, "2025-03-10")).toEqual({ count: 1, changed: true });
  });
  it("same day keeps the count and reports no change", () => {
    expect(nextStreak({ count: 4, lastKey: "2025-03-10" }, "2025-03-10")).toEqual({ count: 4, changed: false });
  });
  it("the next calendar day increments", () => {
    expect(nextStreak({ count: 4, lastKey: "2025-03-10" }, "2025-03-11")).toEqual({ count: 5, changed: true });
  });
  it("a two-day gap resets to 1", () => {
    expect(nextStreak({ count: 9, lastKey: "2025-03-10" }, "2025-03-12")).toEqual({ count: 1, changed: true });
  });
  it("counts across a month boundary", () => {
    expect(nextStreak({ count: 2, lastKey: "2025-02-28" }, "2025-03-01")).toEqual({ count: 3, changed: true });
  });
  it("counts across a year boundary", () => {
    expect(nextStreak({ count: 6, lastKey: "2025-12-31" }, "2026-01-01")).toEqual({ count: 7, changed: true });
  });
});
