import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password";

describe("password hashing", () => {
  it("verifies the right password", async () => {
    const h = await hashPassword("labai-slaptas-1");
    expect(await verifyPassword("labai-slaptas-1", h)).toBe(true);
  });
  it("rejects a wrong password", async () => {
    const h = await hashPassword("labai-slaptas-1");
    expect(await verifyPassword("labai-slaptas-2", h)).toBe(false);
    expect(await verifyPassword("", h)).toBe(false);
  });
  it("produces a different hash each time (random salt)", async () => {
    const a = await hashPassword("tas-pats");
    const b = await hashPassword("tas-pats");
    expect(a).not.toBe(b);
    expect(await verifyPassword("tas-pats", a)).toBe(true);
    expect(await verifyPassword("tas-pats", b)).toBe(true);
  });
  it("stores a versioned format and never the plain password", async () => {
    const h = await hashPassword("slaptazodis");
    expect(h.startsWith("scrypt$")).toBe(true);
    expect(h).not.toContain("slaptazodis");
  });
  it("handles Lithuanian letters", async () => {
    const h = await hashPassword("ąčęėįšųūž-Slaptažodis");
    expect(await verifyPassword("ąčęėįšųūž-Slaptažodis", h)).toBe(true);
    expect(await verifyPassword("aceeisuuz-Slaptazodis", h)).toBe(false);
  });
  it("returns false (does not throw) for a malformed stored hash", async () => {
    expect(await verifyPassword("x", "")).toBe(false);
    expect(await verifyPassword("x", "nesamone")).toBe(false);
    expect(await verifyPassword("x", "scrypt$abc")).toBe(false);
  });
});
