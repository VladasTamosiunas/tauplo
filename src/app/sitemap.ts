import type { MetadataRoute } from "next";
import { getCourses } from "@/lib/courses/catalog";
import { GAMES } from "@/lib/games/catalog";

const SITE = process.env.SITE_URL ?? "http://localhost:3000";

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = ["", "/zaidimai", "/kursai", "/skaiciuokle", "/institucijoms", "/rezultatai", "/privatumas"];
  return [
    ...pages.map((p) => ({ url: `${SITE}${p}`, changeFrequency: "weekly" as const, priority: p === "" ? 1 : 0.7 })),
    ...GAMES.map((g) => ({ url: `${SITE}/zaidimai/${g.slug}`, changeFrequency: "monthly" as const, priority: 0.6 })),
    ...getCourses().map((c) => ({ url: `${SITE}/kursai/${c.slug}`, changeFrequency: "monthly" as const, priority: 0.6 })),
  ];
}
