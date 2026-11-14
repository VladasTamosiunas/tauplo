import { describe, expect, it } from "vitest";
import { parseAmount } from "./parse";

describe("parseAmount", () => {
  it("reads decimal commas and points", () => {
    expect(parseAmount("175,90")).toBe(175.9);
    expect(parseAmount("175.9")).toBe(175.9);
  });
  it("ignores spaces, non-breaking spaces and the euro sign", () => {
    expect(parseAmount("1 234,50")).toBe(1234.5);
    expect(parseAmount("1 234 €")).toBe(1234);
  });
  it("accepts whole numbers and zero", () => {
    expect(parseAmount("1234")).toBe(1234);
    expect(parseAmount("0")).toBe(0);
  });
  it("rejects empty, negative, letters, three decimals and double separators", () => {
    for (const bad of ["", "   ", "-5", "abc", "12,345", "1,2,3", "1e5", "12 ab", "∞", "NaN"]) {
      expect(parseAmount(bad)).toBeNull();
    }
  });
  it("rejects absurdly long numbers", () => {
    expect(parseAmount("12345678901234567890")).toBeNull();
  });
});
