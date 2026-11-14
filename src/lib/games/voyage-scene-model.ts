/**
 * Everything the 3D scene needs to know, as plain numbers. Kept free of three.js so it can be
 * unit tested: the scene itself is only a renderer for these values.
 */

export type PortSlug = "klaipeda" | "juodkrante" | "nida";

/** Where each port sits on the lagoon, in world units (x east, z south). Klaipėda is north, Nida south. */
export const PORT_POSITIONS: Record<PortSlug, { x: number; z: number }> = {
  klaipeda: { x: -3.2, z: -9 },
  juodkrante: { x: 2.6, z: -0.5 },
  nida: { x: -1.4, z: 8.4 },
};

/** Season factor to a mood: 0 is deep winter, 1 is high summer. Clamped, and smooth between months. */
export function seasonMood(season: number): number {
  const s = Math.max(0, Math.min(1.25, season));
  return Math.min(1, s / 1.0);
}

export type SkyLook = {
  top: [number, number, number];
  horizon: [number, number, number];
  sun: [number, number, number];
  sunHeight: number;
  fogDensity: number;
  waterTint: [number, number, number];
  snow: number;
  haze: number;
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const mix = (a: [number, number, number], b: [number, number, number], t: number): [number, number, number] => [
  lerp(a[0], b[0], t),
  lerp(a[1], b[1], t),
  lerp(a[2], b[2], t),
];

const WINTER: SkyLook = {
  top: [0.2, 0.28, 0.42],
  horizon: [0.62, 0.7, 0.78],
  sun: [0.95, 0.9, 0.82],
  sunHeight: 0.24,
  fogDensity: 0.0125,
  waterTint: [0.1, 0.18, 0.26],
  snow: 1,
  haze: 0.55,
};
const SUMMER: SkyLook = {
  top: [0.18, 0.5, 0.84],
  horizon: [0.92, 0.84, 0.68],
  sun: [1.0, 0.86, 0.6],
  sunHeight: 0.62,
  fogDensity: 0.0105,
  waterTint: [0.08, 0.5, 0.62],
  snow: 0,
  haze: 0.22,
};

/** Interpolates the whole look from the season, so July feels warm and January feels cold. */
export function skyForSeason(season: number): SkyLook {
  const t = seasonMood(season);
  return {
    top: mix(WINTER.top, SUMMER.top, t),
    horizon: mix(WINTER.horizon, SUMMER.horizon, t),
    sun: mix(WINTER.sun, SUMMER.sun, t),
    sunHeight: lerp(WINTER.sunHeight, SUMMER.sunHeight, t),
    fogDensity: lerp(WINTER.fogDensity, SUMMER.fogDensity, t),
    waterTint: mix(WINTER.waterTint, SUMMER.waterTint, t),
    snow: lerp(WINTER.snow, SUMMER.snow, t),
    haze: lerp(WINTER.haze, SUMMER.haze, t),
  };
}

export type JarFill = { tax: number; cushion: number; cash: number };

/** 0 to 1 fill level for each jar relative to what it is for. Used to draw the jars on the quay. */
export function jarFill(args: { tax: number; cushion: number; cash: number; fixedMonthlyCost: number; cushionTargetMonths: number }): JarFill {
  const cap = (n: number) => Math.max(0, Math.min(1, n));
  return {
    cushion: cap(args.cushion / (args.fixedMonthlyCost * args.cushionTargetMonths)),
    tax: cap(args.tax / (args.fixedMonthlyCost * 2)),
    cash: cap(args.cash / (args.fixedMonthlyCost * 3)),
  };
}

/** Position along the route for 0 (start) to 1 (arrived), as a smooth curve through the ports. */
export function boatPath(from: PortSlug, to: PortSlug, t: number): { x: number; z: number; heading: number } {
  const a = PORT_POSITIONS[from];
  const b = PORT_POSITIONS[to];
  const k = Math.max(0, Math.min(1, t));
  // ease in and out, plus a gentle sideways bow so the boat curves instead of sailing a straight rail
  const e = k * k * (3 - 2 * k);
  const bow = Math.sin(e * Math.PI) * 1.2 * (from === to ? 0 : 1);
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const len = Math.hypot(dx, dz) || 1;
  const nx = -dz / len;
  const nz = dx / len;
  const x = a.x + dx * e + nx * bow;
  const z = a.z + dz * e + nz * bow;
  const ahead = Math.min(1, k + 0.02);
  const ee = ahead * ahead * (3 - 2 * ahead);
  const bow2 = Math.sin(ee * Math.PI) * 1.2 * (from === to ? 0 : 1);
  const x2 = a.x + dx * ee + nx * bow2;
  const z2 = a.z + dz * ee + nz * bow2;
  const heading = from === to && k === 0 ? 0 : Math.atan2(x2 - x, z2 - z);
  return { x, z, heading };
}

/** Deterministic pseudo-random in 0 to 1 from an integer seed, so the dunes look the same every time. */
export function seeded(seed: number): number {
  const s = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/** Height of the Curonian Spit dunes at a point. Zero well away from the spit. */
export function duneHeight(x: number, z: number): number {
  const ridge = Math.exp(-Math.pow((x - 9.5 - Math.sin(z * 0.35) * 1.4) / 2.6, 2));
  const rolling = 0.55 + 0.45 * Math.sin(x * 0.9 + z * 0.55) * Math.cos(z * 0.42);
  const reach = Math.max(0, Math.min(1, (z + 10) / 8));
  return ridge * rolling * 2.4 * reach;
}

/**
 * Where the player's boat is tied up at a port: in open water beside the quay, on the side the camera looks from.
 * One function, so the scene's mooring and the camera's framing can never drift apart.
 */
export function mooringFor(port: PortSlug): { x: number; z: number } {
  const p = PORT_POSITIONS[port];
  return { x: p.x + 1.9, z: p.z + 2.1 };
}

/** The point the camera rests on at a port: between the port and the moored boat, so both are always in shot. */
export function cameraGoalFor(port: PortSlug): { x: number; z: number } {
  const p = PORT_POSITIONS[port];
  const m = mooringFor(port);
  return { x: (p.x * 2 + m.x) / 3, z: (p.z * 2 + m.z) / 3 + 0.6 };
}

/**
 * The height of the water surface at (x, z) at time t. The renderer moves the water mesh with this exact formula and the
 * boat reads it too, so the hull rides the swell instead of sinking into it.
 */
export function waveHeight(x: number, z: number, t: number, amp: number, wind: number): number {
  return Math.sin(x * 0.6 + t * (0.9 + wind * 0.8)) * amp + Math.cos(z * 0.5 + t * (0.7 + wind * 0.6)) * amp;
}

/** The hull is 0.34 tall, measured up from the keel (the boat's pivot). */
export const HULL_HEIGHT = 0.34;

/** How much of the hull always stands clear of the water: about three fifths of it, so the boat sits in the water, not on it. */
export const HULL_FREEBOARD = 0.2;

/**
 * The height of the boat's pivot (its keel): on the swell, lowered so exactly the freeboard of hull shows above the surface.
 * The keel is therefore always below the water, so the boat never hovers, and no wave can swallow the deck.
 */
export function boatRideHeight(x: number, z: number, t: number, amp: number, wind: number): number {
  return waveHeight(x, z, t, amp, wind) - (HULL_HEIGHT - HULL_FREEBOARD);
}
