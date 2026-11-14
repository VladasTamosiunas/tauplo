import budgetRaw from "../../content/games/biudzeto-detektyvas.json";
import voyageRaw from "../../content/games/kursiu-mariu-kapitonas.json";
import voyageHardRaw from "../../content/games/kursiu-mariu-kapitonas-sunkus-metai.json";
import voyageGentleRaw from "../../content/games/kursiu-mariu-kapitonas-pirmieji-metai.json";
import voyageStormyRaw from "../../content/games/kursiu-mariu-kapitonas-audringi-metai.json";
import labyrinthRaw from "../../content/games/mokesciu-labirintas.json";
import fraudRaw from "../../content/games/sukciu-medziokle.json";
import { prepareContent } from "../content";
import { formatEur } from "../format";
import type { TopicSlug } from "../topics";
import { FraudDeckSchema, ScenarioSchema, VoyageSchema, type FraudDeck, type Scenario, type Voyage } from "./schema";

// prepareContent fills tax-model placeholders and glues figures to their units.
// Doing it once here means the browser and the server replay see identical text.
const scenarios: Scenario[] = [budgetRaw, labyrinthRaw].map((raw) => ScenarioSchema.parse(prepareContent(raw)));
const decks: FraudDeck[] = [FraudDeckSchema.parse(prepareContent(fraudRaw))];

/** Event texts name their amount as {cost}, so the text can never disagree with the number the engine charges. */
function prepareVoyage(raw: unknown): Voyage {
  const v = VoyageSchema.parse(prepareContent(raw));
  const events = Object.fromEntries(
    Object.entries(v.events).map(([key, e]) => [key, { ...e, body: e.body.replaceAll("{cost}", e.cost ? formatEur(e.cost) : "") }]),
  );
  return { ...v, events };
}
const voyages: Voyage[] = [prepareVoyage(voyageGentleRaw), prepareVoyage(voyageRaw), prepareVoyage(voyageHardRaw), prepareVoyage(voyageStormyRaw)];

export type GameMeta = {
  slug: string;
  title: string;
  summary: string;
  minutes: number;
  kind: "scenario" | "fraud" | "voyage";
  topic: TopicSlug;
};

export const GAMES: GameMeta[] = [
  ...scenarios.map((s) => ({
    slug: s.slug,
    title: s.title,
    summary: s.summary,
    minutes: s.minutes,
    kind: "scenario" as const,
    topic: s.topic ?? "biudzetas",
  })),
  ...decks.map((d) => ({
    slug: d.slug,
    title: d.title,
    summary: d.summary,
    minutes: d.minutes,
    kind: "fraud" as const,
    topic: d.topic ?? "sukciai",
  })),
  ...voyages.map((x) => ({
    slug: x.slug,
    title: x.title,
    summary: x.summary,
    minutes: x.minutes,
    kind: "voyage" as const,
    topic: x.topic ?? "taupymas",
  })),
];

export function getGame(slug: string): GameMeta | undefined {
  return GAMES.find((g) => g.slug === slug);
}

export function getScenario(slug: string): Scenario | undefined {
  return scenarios.find((s) => s.slug === slug);
}

export function getFraudDeck(slug: string): FraudDeck | undefined {
  return decks.find((d) => d.slug === slug);
}

export function getVoyage(slug: string): Voyage | undefined {
  return voyages.find((x) => x.slug === slug);
}
