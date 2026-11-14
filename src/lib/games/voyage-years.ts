/**
 * The four years of Kuršių marių kapitonas, easiest first. The slug is the identity everywhere else
 * (catalog, saved runs, badge); this list only adds how a year is presented and ordered.
 */

export type VoyageYear = {
  slug: string;
  /** 1 (gentle) to 4 (hardest). */
  level: 1 | 2 | 3 | 4;
  name: string;
  /** What this year teaches, in one honest sentence. */
  blurb: string;
};

export const VOYAGE_YEARS: VoyageYear[] = [
  {
    slug: "kursiu-mariu-kapitonas-pirmieji-metai",
    level: 1,
    name: "Pirmieji metai",
    blurb: "Ilga vasara, mažos sąskaitos ir švelni žiema. Gera vieta išmokti atidėti pinigus mokesčiams ir pagalvei.",
  },
  {
    slug: "kursiu-mariu-kapitonas",
    level: 2,
    name: "Įprasti metai",
    blurb: "Vasarą uždirbi daug, žiemą beveik nieko. Pagalvė ir mokesčių indas nulemia, ar žiemą bus iš ko mokėti.",
  },
  {
    slug: "kursiu-mariu-kapitonas-sunkus-metai",
    level: 3,
    name: "Sunkūs metai",
    blurb: "Prastas laimikis ir ilga žiema. Viena klaida, pavyzdžiui, pakliuvimas ant sukčių, kainuoja visus metus.",
  },
  {
    slug: "kursiu-mariu-kapitonas-audringi-metai",
    level: 4,
    name: "Audringi metai",
    blurb: "Daug audrų ir keli gedimai. Atvirose mariose didelis uždarbis, bet be draudimo ir pagalvės vienas gedimas viską nuplauna.",
  },
];

/** 1 to 4 for a known year, 0 for anything else. */
export function difficultyOf(slug: string): 0 | 1 | 2 | 3 | 4 {
  return VOYAGE_YEARS.find((y) => y.slug === slug)?.level ?? 0;
}

export function yearBySlug(slug: string): VoyageYear | undefined {
  return VOYAGE_YEARS.find((y) => y.slug === slug);
}
