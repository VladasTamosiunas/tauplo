"use client";

import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import type { Weather } from "@/lib/games/schema";
import type { JarFill, PortSlug } from "@/lib/games/voyage-scene-model";
import { createVoyageScene, type VoyageScene } from "./scene";

export type CanvasHandle = { sail: (to: PortSlug, ms: number) => Promise<void> };

type Props = {
  season: number;
  port: PortSlug;
  gear: number;
  jars: JarFill;
  weather?: Weather;
  handleRef: Ref<CanvasHandle>;
  label: string;
};

/**
 * The 3D lagoon. three.js owns the canvas and its render loop, so React only passes it numbers.
 * If WebGL is not available the component shows a plain text fallback and the game stays playable.
 */
export function VoyageCanvas({ season, port, gear, jars, weather = "calm", handleRef, label }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<VoyageScene | null>(null);
  const [failed, setFailed] = useState(false);

  useImperativeHandle(handleRef, () => ({
    sail: (to, ms) => (sceneRef.current ? sceneRef.current.sail(to, ms) : Promise.resolve()),
  }));

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    let scene: VoyageScene;
    try {
      scene = createVoyageScene({ canvas, reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches });
    } catch {
      // WebGL unavailable or the context was lost at start: keep the game playable without the picture.
      // Deferred a tick so the state update is not made synchronously inside the effect body.
      const t = window.setTimeout(() => setFailed(true), 0);
      return () => window.clearTimeout(t);
    }
    sceneRef.current = scene;
    const fit = () => scene.resize(wrap.clientWidth, wrap.clientHeight);
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(wrap);
    return () => {
      ro.disconnect();
      scene.dispose();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    sceneRef.current?.setState({
      season,
      port,
      gear,
      jars,
      weather,
      dark: window.matchMedia("(prefers-color-scheme: dark)").matches,
    });
  }, [season, port, gear, jars, weather]);

  return (
    <div ref={wrapRef} className="relative h-full w-full overflow-hidden bg-[#9fc3cf]">
      {failed ? (
        <p className="grid h-full place-items-center p-6 text-center text-sm text-ink-2">
          3D vaizdas šiame įrenginyje nepasiekiamas, bet žaidimas veikia kaip įprasta.
        </p>
      ) : (
        <canvas ref={canvasRef} role="img" aria-label={label} className="block h-full w-full" />
      )}
    </div>
  );
}
