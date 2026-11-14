import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { GAMES } from "./catalog";
import { FraudDeckSchema, ScenarioSchema, VoyageSchema } from "./schema";
import { estimateIndividualActivity } from "./tax-rules";

const dir = path.resolve(__dirname, "../../content/games");
const files = readdirSync(dir).filter((f) => f.endsWith(".json"));

describe("game content files", () => {
  it("there are seven games, and every file is listed in the catalog", () => {
    expect(files).toHaveLength(7);
    expect(GAMES).toHaveLength(7);
    expect(new Set(GAMES.map((g) => `${g.slug}.json`))).toEqual(new Set(files));
  });

  for (const file of files) {
    describe(file, () => {
      const raw = JSON.parse(readFileSync(path.join(dir, file), "utf8"));

      it("parses with its schema", () => {
        const schema = raw.kind === "fraud" ? FraudDeckSchema : raw.kind === "voyage" ? VoyageSchema : ScenarioSchema;
        expect(() => schema.parse(raw)).not.toThrow();
      });

      it("has a slug that matches its file name", () => {
        expect(`${raw.slug}.json`).toBe(file);
      });

      it("contains no em-dashes or en-dashes in visible text", () => {
        expect(JSON.stringify(raw)).not.toMatch(/[–—]/);
      });

      if (raw.kind === "scenario") {
        const s = ScenarioSchema.parse(raw);
        it("has unique step ids", () => {
          expect(new Set(s.steps.map((x) => x.id)).size).toBe(s.steps.length);
        });
        it("every estimate step has a positive income and a reachable answer", () => {
          for (const step of s.steps) {
            if (step.type !== "estimate") continue;
            expect(step.incomeEur).toBeGreaterThan(0);
            expect(estimateIndividualActivity(step.incomeEur)[step.quantity]).toBeGreaterThan(0);
          }
        });
        it("every choice step offers at least one good option", () => {
          for (const step of s.steps) {
            if (step.type === "choice") expect(step.choices.some((c) => c.tone === "good")).toBe(true);
          }
        });
      } else if (raw.kind === "voyage") {
        const x = VoyageSchema.parse(raw);
        it("covers twelve months, each with a known port and event", () => {
          expect(x.months).toHaveLength(12);
          const ports = new Set(x.ports.map((p) => p.slug));
          for (const m of x.months) {
            expect(ports.has(m.port)).toBe(true);
            expect(m.event in x.events).toBe(true);
          }
        });
        it("has winter months, summer months and a strictly higher summer peak", () => {
          const seasons = x.months.map((m) => m.season);
          expect(Math.min(...seasons)).toBeLessThan(0.3);
          expect(Math.max(...seasons)).toBeGreaterThan(1);
        });
        it("every event with a cost names it as {cost} or not at all, never a hard-coded euro amount", () => {
          for (const e of Object.values(x.events)) {
            if (e.cost) expect(e.body).toContain("{cost}");
            expect(e.body).not.toMatch(/\d\s?€/);
          }
        });
        it("has exactly one scam event, with a cost, so there is something to refuse", () => {
          const scams = Object.values(x.events).filter((e) => e.scam);
          expect(scams).toHaveLength(1);
          expect(scams[0].cost).toBeGreaterThan(0);
        });
        it("tax is due on real months and gear pays more at every level", () => {
          for (const m of x.taxDueMonths) expect(m).toBeGreaterThanOrEqual(1);
          for (let i = 1; i < x.gear.incomeMultiplier.length; i++) {
            expect(x.gear.incomeMultiplier[i]).toBeGreaterThan(x.gear.incomeMultiplier[i - 1]);
          }
        });
      } else {
        const d = FraudDeckSchema.parse(raw);
        it("has both scam and safe items", () => {
          expect(d.items.some((i) => i.isScam)).toBe(true);
          expect(d.items.some((i) => !i.isScam)).toBe(true);
        });
        it("every scam has at least one red flag and every safe item has none", () => {
          for (const i of d.items) {
            if (i.isScam) expect(i.flags.length).toBeGreaterThan(0);
            else expect(i.flags).toHaveLength(0);
          }
        });
        it("every red flag refers to a deck flag option", () => {
          const ids = new Set(d.flagOptions.map((f) => f.id));
          for (const i of d.items) for (const f of i.flags) expect(ids.has(f.id)).toBe(true);
        });
        it("has unique item ids", () => {
          expect(new Set(d.items.map((i) => i.id)).size).toBe(d.items.length);
        });
      }
    });
  }
});
