import type { Weather } from "./schema";
import type { SkyLook } from "./voyage-scene-model";

/**
 * How the weather looks, as plain numbers, so the 3D scene only has to draw them. The three weathers are
 * a clear step apart (rain, waves, cloud and wind rise; light and visibility fall), which is what lets a
 * player read the sky and judge a forecast. Every value is 0 to 1.
 */

export type WeatherLook = {
  /** Share of full rainfall to draw. */
  rain: number;
  /** Wave height relative to a calm lagoon. */
  waveHeight: number;
  /** Cloud cover. */
  cloud: number;
  /** How hard the wind pushes the flags, smoke and rain. */
  wind: number;
  /** How often soft lightning lights the sky (0 means never). */
  lightning: number;
  /** Overall brightness of the light. */
  light: number;
  /** How far you can see (lower means thicker haze). */
  visibility: number;
};

const LOOKS: Record<Weather, WeatherLook> = {
  calm: { rain: 0, waveHeight: 0.25, cloud: 0.15, wind: 0.12, lightning: 0, light: 1, visibility: 1 },
  rough: { rain: 0.4, waveHeight: 0.7, cloud: 0.65, wind: 0.55, lightning: 0, light: 0.78, visibility: 0.7 },
  storm: { rain: 1, waveHeight: 1.3, cloud: 1, wind: 1, lightning: 0.35, light: 0.5, visibility: 0.4 },
};

export function weatherLook(weather: Weather): WeatherLook {
  return { ...LOOKS[weather] };
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
type Rgb = [number, number, number];

/** Pulls a colour toward a grey storm colour by `k`, keeping a trace of the original so the season still shows. */
function toward(c: Rgb, grey: Rgb, k: number): Rgb {
  return [clamp01(c[0] + (grey[0] - c[0]) * k), clamp01(c[1] + (grey[1] - c[1]) * k), clamp01(c[2] + (grey[2] - c[2]) * k)];
}

/**
 * Applies the weather to the season's look: the sky and sun darken toward a stormy grey, the fog thickens
 * and the sun drops. Calm leaves the season exactly as it was. The input is not modified.
 */
export function applyWeather(look: SkyLook, weather: Weather): SkyLook {
  if (weather === "calm") return { ...look, top: [...look.top], horizon: [...look.horizon], sun: [...look.sun], waterTint: [...look.waterTint] };
  const w = LOOKS[weather];
  const k = w.cloud * 0.55; // how far toward grey
  const dim = w.light;
  const scale = (c: Rgb): Rgb => [clamp01(c[0] * dim), clamp01(c[1] * dim), clamp01(c[2] * dim)];
  return {
    ...look,
    top: scale(toward(look.top, [0.28, 0.31, 0.36], k)),
    horizon: scale(toward(look.horizon, [0.45, 0.48, 0.52], k)),
    sun: scale(toward(look.sun, [0.6, 0.62, 0.66], k)),
    waterTint: scale(toward(look.waterTint, [0.1, 0.16, 0.2], k * 0.8)),
    sunHeight: Math.max(0, look.sunHeight * (1 - w.cloud * 0.55)),
    fogDensity: look.fogDensity * (1 + (1 - w.visibility) * 2.6),
    haze: clamp01(look.haze + (1 - w.visibility) * 0.5),
  };
}
