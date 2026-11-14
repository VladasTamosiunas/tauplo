import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { resetDb } from "@/test/db";
import { authenticate, registerUser } from "./users";
import { createSessionRecord, deleteSessionRecord, findUserBySessionToken } from "./sessions";

beforeEach(resetDb);

const valid = { email: "Rugile@Example.lt", password: "geras-slaptazodis", displayName: "Rugilė", role: "STUDENT" as const };

describe("registerUser", () => {
  it("creates a user with a hashed password and a lowercase email", async () => {
    const r = await registerUser(valid);
    expect(r.ok).toBe(true);
    const u = await db.user.findUniqueOrThrow({ where: { email: "rugile@example.lt" } });
    expect(u.passwordHash).not.toContain("geras-slaptazodis");
    expect(u.role).toBe("STUDENT");
    expect(u.xp).toBe(0);
    expect(u.financialIq).toBe(40);
  });
  it("rejects the same email in a different case", async () => {
    await registerUser(valid);
    const r = await registerUser({ ...valid, email: "RUGILE@example.LT" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.email).toBeTruthy();
    expect(await db.user.count()).toBe(1);
  });
  it("rejects a password shorter than 8 characters", async () => {
    const r = await registerUser({ ...valid, password: "trumpas" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.password).toBeTruthy();
    expect(await db.user.count()).toBe(0);
  });
  it("rejects a malformed email, an empty name and an unknown role", async () => {
    const bad = await registerUser({ ...valid, email: "ne-el-pastas", displayName: " ", role: "ADMIN" as never });
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(bad.errors.email).toBeTruthy();
      expect(bad.errors.displayName).toBeTruthy();
      expect(bad.errors.role).toBeTruthy();
    }
  });
  it("trims the display name", async () => {
    await registerUser({ ...valid, displayName: "  Rugilė  " });
    const u = await db.user.findFirstOrThrow();
    expect(u.displayName).toBe("Rugilė");
  });
});

describe("authenticate", () => {
  it("returns the user for the right email and password, in any email case", async () => {
    await registerUser(valid);
    expect(await authenticate("rugile@example.lt", valid.password)).not.toBeNull();
    expect(await authenticate("RUGILE@EXAMPLE.LT", valid.password)).not.toBeNull();
  });
  it("returns null for a wrong password", async () => {
    await registerUser(valid);
    expect(await authenticate("rugile@example.lt", "neteisingas-slaptazodis")).toBeNull();
  });
  it("returns null for an unknown email, the same as for a wrong password", async () => {
    expect(await authenticate("niekas@example.lt", "kazkas-kazkas")).toBeNull();
  });
});

describe("session records", () => {
  it("stores only a hash of the token and resolves the user from the token", async () => {
    const r = await registerUser(valid);
    if (!r.ok) throw new Error("registration failed");
    const token = await createSessionRecord(r.userId);
    const stored = await db.session.findFirstOrThrow();
    expect(stored.tokenHash).not.toBe(token);
    const user = await findUserBySessionToken(token);
    expect(user?.id).toBe(r.userId);
    expect(user).not.toHaveProperty("passwordHash");
  });
  it("does not resolve an unknown, empty or expired token", async () => {
    const r = await registerUser(valid);
    if (!r.ok) throw new Error("registration failed");
    const token = await createSessionRecord(r.userId);
    expect(await findUserBySessionToken("neteisingas")).toBeNull();
    expect(await findUserBySessionToken("")).toBeNull();
    await db.session.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await findUserBySessionToken(token)).toBeNull();
  });
  it("deleting a session ends it", async () => {
    const r = await registerUser(valid);
    if (!r.ok) throw new Error("registration failed");
    const token = await createSessionRecord(r.userId);
    await deleteSessionRecord(token);
    expect(await findUserBySessionToken(token)).toBeNull();
  });
});
