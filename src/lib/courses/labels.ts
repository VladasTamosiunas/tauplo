import type { Audience, Course, Level } from "./schema";

// Kept apart from catalog.ts so client components can use labels without
// bundling every course file into the browser.

export const AUDIENCE_LABEL: Record<Audience, string> = {
  mokiniai: "Moksleiviams (5-12 kl.)",
  suaugusieji: "Suaugusiems",
  verslas: "Verslui / Laisvai samdai",
};

export const LEVEL_LABEL: Record<Level, string> = {
  pradedantieji: "Pradedantiesiems",
  pazenge: "Pažengusiems",
};

export function totalMinutes(c: Pick<Course, "lessons">): number {
  return c.lessons.reduce((n, l) => n + l.minutes, 0);
}
