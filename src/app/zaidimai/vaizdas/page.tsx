import { notFound } from "next/navigation";
import { VoyageCanvas } from "@/components/games/voyage/VoyageCanvas";
import type { PortSlug } from "@/lib/games/voyage-scene-model";

/**
 * Development-only viewer for the 3D scene: /zaidimai/vaizdas?season=0.15&port=nida&gear=2.
 * It renders only the canvas, so the lagoon can be inspected in any season without playing a year.
 * In production it does not exist.
 */
export default async function ScenePreview({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  if (process.env.NODE_ENV === "production" && process.env.TAUPLO_SCENE_PREVIEW !== "1") notFound();
  const q = await searchParams;
  const season = Math.min(1.3, Math.max(0, Number(q.season ?? 0.5)));
  const port = (["klaipeda", "juodkrante", "nida"].includes(q.port ?? "") ? q.port : "klaipeda") as PortSlug;
  const gear = Math.min(3, Math.max(1, Math.round(Number(q.gear ?? 1))));
  const fill = Math.min(1, Math.max(0, Number(q.fill ?? 0.5)));
  const weather = (["calm", "rough", "storm"].includes(q.weather ?? "") ? q.weather : "calm") as "calm" | "rough" | "storm";
  return (
    <div className="h-[calc(100dvh-4rem)] w-full">
      <VoyageCanvas
        season={season}
        port={port}
        gear={gear}
        jars={{ tax: fill, cushion: fill, cash: fill }}
        weather={weather}
        handleRef={{ current: null }}
        label="Kuršių marių 3D vaizdas"
      />
    </div>
  );
}
