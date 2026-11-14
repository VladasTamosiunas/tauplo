import { describe, expect, it } from "vitest";
import { CODE_ALPHABET, generateCertificateId, generateJoinCode, normalizeJoinCode } from "./codes";

describe("generateJoinCode", () => {
  it("looks like TK- plus four unambiguous characters", () => {
    for (let i = 0; i < 200; i++) expect(generateJoinCode()).toMatch(/^TK-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/);
  });
  it("never uses lookalike characters", () => {
    for (const bad of ["0", "O", "1", "I"]) expect(CODE_ALPHABET).not.toContain(bad);
  });
  it("varies", () => {
    expect(new Set(Array.from({ length: 50 }, generateJoinCode)).size).toBeGreaterThan(40);
  });
});

describe("generateCertificateId", () => {
  it("is TS- plus ten characters", () => {
    expect(generateCertificateId()).toMatch(/^TS-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{10}$/);
  });
});

describe("normalizeJoinCode", () => {
  it("accepts any case, spaces and a missing prefix", () => {
    expect(normalizeJoinCode("tk-7q42")).toBe("TK-7Q42");
    expect(normalizeJoinCode("  7q42 ")).toBe("TK-7Q42");
    expect(normalizeJoinCode("TK 7Q42")).toBe("TK-7Q42");
    expect(normalizeJoinCode("TK-7Q42")).toBe("TK-7Q42");
  });
  it("returns an empty string for empty input", () => {
    expect(normalizeJoinCode("   ")).toBe("");
  });
});
