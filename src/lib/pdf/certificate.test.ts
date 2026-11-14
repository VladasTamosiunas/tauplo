import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { certificateFileName, renderCertificate } from "./certificate";

const base = {
  learnerName: "Rugilė Jonaitytė",
  courseTitle: "II ir III pensijų pakopa",
  issuedAt: new Date("2026-11-01T10:00:00Z"),
  code: "TS-4H7K2M9QXB",
};

describe("renderCertificate", () => {
  it("returns a real, non-trivial PDF", async () => {
    const bytes = await renderCertificate(base);
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe("%PDF-");
    expect(bytes.length).toBeGreaterThan(5000);
  });
  it("is a single landscape A4 page", async () => {
    const pdf = await PDFDocument.load(await renderCertificate(base));
    expect(pdf.getPageCount()).toBe(1);
    const { width, height } = pdf.getPage(0).getSize();
    expect(Math.round(width)).toBe(842);
    expect(Math.round(height)).toBe(595);
  });
  it("does not throw on every Lithuanian letter in the learner's name", async () => {
    const bytes = await renderCertificate({ ...base, learnerName: "Ąžuolas Čėsnauskas-Šūkys Įstrižas" });
    expect(bytes.length).toBeGreaterThan(5000);
  });
  it("does not throw on quotes, euro signs and a title with Lithuanian quotes", async () => {
    const bytes = await renderCertificate({ ...base, courseTitle: "Investicijos su „garantuotu pelnu“ (100 €)" });
    expect(bytes.length).toBeGreaterThan(5000);
  });
  it("copes with a very long name by shrinking it instead of overflowing", async () => {
    const long = "Vardenis Pavardenis ".repeat(8).trim();
    await expect(renderCertificate({ ...base, learnerName: long })).resolves.toBeInstanceOf(Uint8Array);
  });
  it("copes with a very long course title", async () => {
    const long = "Labai ilgas kurso pavadinimas apie finansus ".repeat(5).trim();
    await expect(renderCertificate({ ...base, courseTitle: long })).resolves.toBeInstanceOf(Uint8Array);
  });
  it("replaces characters the font cannot draw instead of crashing (emoji, CJK)", async () => {
    const bytes = await renderCertificate({ ...base, learnerName: "Jonas 😀 漢字" });
    expect(bytes.length).toBeGreaterThan(5000);
  });
  it("copes with an empty name", async () => {
    await expect(renderCertificate({ ...base, learnerName: "   " })).resolves.toBeInstanceOf(Uint8Array);
  });
});

describe("certificateFileName", () => {
  it("is ASCII-safe and contains the code", () => {
    const name = certificateFileName({ ...base, courseTitle: "Pagalvė nenumatytoms išlaidoms" });
    expect(name).toMatch(/^[\x20-\x7E]+$/);
    expect(name).toContain("TS-4H7K2M9QXB");
    expect(name.endsWith(".pdf")).toBe(true);
  });
});
