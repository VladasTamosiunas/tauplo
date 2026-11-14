export type ProgressSnapshot = {
  lessonsCompleted: number;
  coursesCompleted: number;
  bestBudgetIq: number;
  bestFraudPct: number;
  taxRuns: number;
  cushionPlanMonths: number | null;
  streak: number;
  bestVoyageIq: number;
};

type BadgeDef = {
  slug: string;
  name: string;
  description: string;
  earned: (s: ProgressSnapshot) => boolean;
};

const DEFS: BadgeDef[] = [
  {
    slug: "pirmas-zingsnis",
    name: "Pirmas žingsnis",
    description: "Perskaitei pirmąją pamoką.",
    earned: (s) => s.lessonsCompleted >= 1,
  },
  {
    slug: "kurso-baigimas",
    name: "Kurso baigėjas",
    description: "Išlaikei kurso testą.",
    earned: (s) => s.coursesCompleted >= 1,
  },
  {
    slug: "budrus-detektyvas",
    name: "Budrus detektyvas",
    description: "Biudžeto detektyve pasiekei Finansinį IQ 90 ar daugiau.",
    earned: (s) => s.bestBudgetIq >= 90,
  },
  {
    slug: "sukciu-medziotojas",
    name: "Sukčių medžiotojas",
    description: "Atpažinai bent 80 % sukčių ir tikrų žinučių.",
    earned: (s) => s.bestFraudPct >= 80,
  },
  {
    slug: "mokesciu-keliautojas",
    name: "Mokesčių keliautojas",
    description: "Perėjai Mokesčių labirintą.",
    earned: (s) => s.taxRuns >= 1,
  },
  {
    slug: "pagalves-architektas",
    name: "Pagalvės architektas",
    description: "Suplanavai bent 3 mėnesių išlaidų pagalvę.",
    earned: (s) => s.cushionPlanMonths !== null && s.cushionPlanMonths >= 3,
  },
  {
    slug: "ziemos-kapitonas",
    name: "Žiemos kapitonas",
    description: "Kuršių marių kapitone pereini metus su pagalve ir nepritrūksti pinigų žiemą.",
    earned: (s) => s.bestVoyageIq >= 75,
  },
  {
    slug: "savaites-serija",
    name: "Savaitės serija",
    description: "Mokeisi 7 dienas iš eilės.",
    earned: (s) => s.streak >= 7,
  },
];

export const BADGES: { slug: string; name: string; description: string }[] = DEFS.map(
  ({ slug, name, description }) => ({ slug, name, description }),
);

/** Slugs of every badge the snapshot qualifies for. The caller stores only the new ones. */
export function evaluateBadges(s: ProgressSnapshot): string[] {
  return DEFS.filter((d) => d.earned(s)).map((d) => d.slug);
}
