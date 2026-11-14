import { describe, expect, it } from "vitest";
import { hashToken, newToken } from "./token";

describe("session tokens", () => {
  it("are url-safe and long enough to be unguessable", () => {
    const t = newToken();
    expect(t).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });
  it("are unique", () => {
    expect(new Set(Array.from({ length: 50 }, newToken)).size).toBe(50);
  });
  it("hash to a stable 64-character hex digest", () => {
    const h = hashToken("abc");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken("abc")).toBe(h);
    expect(hashToken("abd")).not.toBe(h);
  });
  it("hash differs from the token itself", () => {
    const t = newToken();
    expect(hashToken(t)).not.toBe(t);
  });
});
