import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { resetDb } from "@/test/db";
import { submitInquiry } from "./inquiries";

beforeEach(resetDb);

const valid = {
  orgName: "Vilniaus rajono savivaldybės švietimo skyrius",
  projectType: "SCHOOL_MUNICIPALITY" as const,
  contactName: "Jonas Jonaitis",
  email: "Jonas@Savivaldybe.lt",
  message: "Norime surengti finansų olimpiadą 9-12 klasėms.",
  consent: true,
};

describe("submitInquiry", () => {
  it("stores a valid inquiry with a lowercase email", async () => {
    const r = await submitInquiry(valid);
    expect(r).toEqual({ ok: true });
    const row = await db.inquiry.findFirstOrThrow();
    expect(row.orgName).toBe(valid.orgName);
    expect(row.email).toBe("jonas@savivaldybe.lt");
    expect(row.projectType).toBe("SCHOOL_MUNICIPALITY");
    expect(row.consent).toBe(true);
  });
  it("requires explicit consent", async () => {
    const r = await submitInquiry({ ...valid, consent: false });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.consent).toBeTruthy();
    expect(await db.inquiry.count()).toBe(0);
  });
  it("rejects a malformed email", async () => {
    const r = await submitInquiry({ ...valid, email: "ne-el-pastas" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.email).toBeTruthy();
    expect(await db.inquiry.count()).toBe(0);
  });
  it("reports every problem at once, keyed by field", async () => {
    const r = await submitInquiry({ orgName: " ", projectType: "NEZINOMAS", contactName: "", email: "x", consent: false });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(["consent", "contactName", "email", "orgName", "projectType"]);
  });
  it("message is optional", async () => {
    const { message: _omit, ...withoutMessage } = valid;
    void _omit;
    expect((await submitInquiry(withoutMessage)).ok).toBe(true);
    expect((await db.inquiry.findFirstOrThrow()).message).toBeNull();
  });
  it("trims text fields and caps their length", async () => {
    expect((await submitInquiry({ ...valid, orgName: "  Mokykla  " })).ok).toBe(true);
    expect((await db.inquiry.findFirstOrThrow()).orgName).toBe("Mokykla");
    const tooLong = await submitInquiry({ ...valid, orgName: "x".repeat(201) });
    expect(tooLong.ok).toBe(false);
    const tooLongMsg = await submitInquiry({ ...valid, message: "x".repeat(2001) });
    expect(tooLongMsg.ok).toBe(false);
  });
  it("pretends to succeed but stores nothing when the hidden honeypot field is filled", async () => {
    const r = await submitInquiry({ ...valid, website: "http://spam.example" });
    expect(r).toEqual({ ok: true });
    expect(await db.inquiry.count()).toBe(0);
  });
  it("treats non-string input as invalid instead of throwing", async () => {
    const r = await submitInquiry({ ...valid, orgName: { $ne: null }, email: 42 });
    expect(r.ok).toBe(false);
  });
  it("rejects a null or non-object payload", async () => {
    expect((await submitInquiry(null)).ok).toBe(false);
    expect((await submitInquiry("tekstas")).ok).toBe(false);
    expect((await submitInquiry(undefined)).ok).toBe(false);
  });
});
