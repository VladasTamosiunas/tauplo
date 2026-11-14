import { describe, expect, it } from "vitest";
import { HULL_FREEBOARD, HULL_HEIGHT, PORT_POSITIONS, boatPath, boatRideHeight, cameraGoalFor, duneHeight, jarFill, mooringFor, seasonMood, seeded, skyForSeason, waveHeight, type PortSlug } from "./voyage-scene-model";

const PORTS = Object.keys(PORT_POSITIONS) as PortSlug[];

describe("boatPath", () => {
  it("starts exactly at the origin port and ends exactly at the destination", () => {
    for (const a of PORTS) {
      for (const b of PORTS) {
        const s = boatPath(a, b, 0);
        const e = boatPath(a, b, 1);
        expect(s.x).toBeCloseTo(PORT_POSITIONS[a].x, 6);
        expect(s.z).toBeCloseTo(PORT_POSITIONS[a].z, 6);
        expect(e.x).toBeCloseTo(PORT_POSITIONS[b].x, 6);
        expect(e.z).toBeCloseTo(PORT_POSITIONS[b].z, 6);
      }
    }
  });
  it("clamps progress outside 0 to 1 instead of overshooting the port", () => {
    const before = boatPath("klaipeda", "nida", -5);
    const after = boatPath("klaipeda", "nida", 9);
    expect(before.x).toBeCloseTo(PORT_POSITIONS.klaipeda.x, 6);
    expect(after.z).toBeCloseTo(PORT_POSITIONS.nida.z, 6);
  });
  it("moves monotonically from north to south on the Klaipėda to Nida leg", () => {
    let last = -Infinity;
    for (let i = 0; i <= 20; i++) {
      const z = boatPath("klaipeda", "nida", i / 20).z;
      expect(z).toBeGreaterThanOrEqual(last - 1e-9);
      last = z;
    }
  });
  it("stays on the lagoon: never further than 2 units off the straight line between ports", () => {
    for (let i = 0; i <= 20; i++) {
      const p = boatPath("klaipeda", "juodkrante", i / 20);
      const a = PORT_POSITIONS.klaipeda;
      const b = PORT_POSITIONS.juodkrante;
      const dist = Math.abs((b.z - a.z) * p.x - (b.x - a.x) * p.z + b.x * a.z - b.z * a.x) / Math.hypot(b.x - a.x, b.z - a.z);
      expect(dist).toBeLessThan(2);
    }
  });
  it("a boat staying in port does not drift and does not produce NaN", () => {
    for (let i = 0; i <= 10; i++) {
      const p = boatPath("nida", "nida", i / 10);
      expect(p.x).toBeCloseTo(PORT_POSITIONS.nida.x, 6);
      expect(p.z).toBeCloseTo(PORT_POSITIONS.nida.z, 6);
      expect(Number.isFinite(p.heading)).toBe(true);
    }
  });
  it("heading points roughly toward the destination mid-leg", () => {
    const p = boatPath("klaipeda", "nida", 0.5);
    expect(Math.cos(p.heading)).toBeGreaterThan(0); // heading has a +z (southward) component
  });
});

describe("skyForSeason", () => {
  it("summer is brighter, higher-sunned and clearer than winter", () => {
    const w = skyForSeason(0.12);
    const s = skyForSeason(1.25);
    expect(s.sunHeight).toBeGreaterThan(w.sunHeight);
    expect(s.fogDensity).toBeLessThan(w.fogDensity);
    expect(s.snow).toBeLessThan(w.snow);
    expect(s.haze).toBeLessThan(w.haze);
  });
  it("is continuous: a small change in season never jumps the look", () => {
    let prev = skyForSeason(0).sunHeight;
    for (let i = 1; i <= 100; i++) {
      const cur = skyForSeason(i / 80).sunHeight;
      expect(Math.abs(cur - prev)).toBeLessThan(0.02);
      prev = cur;
    }
  });
  it("keeps every colour channel in 0 to 1 for any input, including nonsense", () => {
    for (const x of [-3, 0, 0.5, 1, 1.25, 4, Number.MAX_SAFE_INTEGER]) {
      const sky = skyForSeason(x);
      for (const c of [...sky.top, ...sky.horizon, ...sky.sun, ...sky.waterTint]) {
        expect(c).toBeGreaterThanOrEqual(0);
        expect(c).toBeLessThanOrEqual(1);
      }
    }
  });
  it("seasonMood is between 0 and 1", () => {
    for (const x of [-1, 0, 0.3, 1, 2]) {
      expect(seasonMood(x)).toBeGreaterThanOrEqual(0);
      expect(seasonMood(x)).toBeLessThanOrEqual(1);
    }
  });
});

describe("jarFill", () => {
  const base = { fixedMonthlyCost: 420, cushionTargetMonths: 3 };
  it("is empty for empty jars and full at the target", () => {
    expect(jarFill({ ...base, tax: 0, cushion: 0, cash: 0 })).toEqual({ tax: 0, cushion: 0, cash: 0 });
    expect(jarFill({ ...base, tax: 0, cash: 0, cushion: 420 * 3 }).cushion).toBe(1);
  });
  it("never goes outside 0 to 1", () => {
    const f = jarFill({ ...base, tax: 99999, cushion: 99999, cash: 99999 });
    expect(f).toEqual({ tax: 1, cushion: 1, cash: 1 });
    expect(jarFill({ ...base, tax: -50, cushion: -50, cash: -50 })).toEqual({ tax: 0, cushion: 0, cash: 0 });
  });
  it("is proportional in between", () => {
    expect(jarFill({ ...base, tax: 0, cash: 0, cushion: 630 }).cushion).toBeCloseTo(0.5, 6);
  });
});

describe("terrain helpers", () => {
  it("seeded is deterministic, between 0 and 1, and varies", () => {
    expect(seeded(7)).toBe(seeded(7));
    const vals = Array.from({ length: 60 }, (_, i) => seeded(i));
    for (const x of vals) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
    expect(new Set(vals.map((x) => x.toFixed(4))).size).toBeGreaterThan(50);
  });
  it("dunes rise on the spit side and are flat out on the open lagoon", () => {
    expect(duneHeight(9.5, 2)).toBeGreaterThan(0.5);
    expect(duneHeight(-12, 2)).toBeLessThan(0.01);
    expect(duneHeight(0, 2)).toBeLessThan(0.3);
  });
  it("never produces a negative or non-finite height", () => {
    for (let x = -15; x <= 15; x += 1.5) {
      for (let z = -12; z <= 12; z += 1.5) {
        const h = duneHeight(x, z);
        expect(Number.isFinite(h)).toBe(true);
        expect(h).toBeGreaterThanOrEqual(0);
      }
    }
  });
  it("the three ports sit on water, not inside the dunes", () => {
    for (const p of PORTS) expect(duneHeight(PORT_POSITIONS[p].x, PORT_POSITIONS[p].z)).toBeLessThan(0.3);
  });
});

describe("mooring and framing: the player's boat is always in shot", () => {
  const ports = Object.keys(PORT_POSITIONS) as PortSlug[];

  it("moors the boat beside its port, close enough to be framed with it", () => {
    for (const port of ports) {
      const m = mooringFor(port);
      const p = PORT_POSITIONS[port];
      expect(Math.hypot(m.x - p.x, m.z - p.z)).toBeLessThan(4);
      expect(Math.hypot(m.x - p.x, m.z - p.z)).toBeGreaterThan(0.5);
    }
  });
  it("aims the camera between the port and the boat, so both are inside the view", () => {
    for (const port of ports) {
      const m = mooringFor(port);
      const p = PORT_POSITIONS[port];
      const g = cameraGoalFor(port);
      const toPort = Math.hypot(g.x - p.x, g.z - p.z);
      const toBoat = Math.hypot(g.x - m.x, g.z - m.z);
      // the goal sits no further than 3 units from either, comfortably inside the view at the game's camera distance
      expect(toPort).toBeLessThan(3);
      expect(toBoat).toBeLessThan(3);
    }
  });
  it("is a pure function of the port", () => {
    for (const port of ports) {
      expect(cameraGoalFor(port)).toEqual(cameraGoalFor(port));
      expect(mooringFor(port)).toEqual(mooringFor(port));
    }
  });
  it("gives each port a different framing", () => {
    const goals = ports.map((p) => cameraGoalFor(p));
    expect(new Set(goals.map((g) => `${g.x.toFixed(1)},${g.z.toFixed(1)}`)).size).toBe(ports.length);
  });
});

describe("waves and the boat that rides them", () => {
  const sample = (amp: number, wind: number) => {
    const out: number[] = [];
    for (let x = -12; x <= 12; x += 1.7) for (let z = -12; z <= 12; z += 1.9) for (let t = 0; t < 40; t += 1.3) out.push(waveHeight(x, z, t, amp, wind));
    return out;
  };
  it("is flat when there is no swell, and never larger than twice the amplitude", () => {
    expect(waveHeight(3, -4, 7, 0, 0.5)).toBe(0);
    for (const h of sample(0.2, 1)) expect(Math.abs(h)).toBeLessThanOrEqual(0.4 + 1e-9);
  });
  it("is a pure function of position, time, amplitude and wind", () => {
    expect(waveHeight(1.5, 2.5, 9, 0.1, 0.4)).toBe(waveHeight(1.5, 2.5, 9, 0.1, 0.4));
  });
  it("is calmer than a storm: a storm swing is several times a calm one", () => {
    const range = (xs: number[]) => Math.max(...xs) - Math.min(...xs);
    expect(range(sample(0.05 * (0.4 + 1.3 * 1.6), 1))).toBeGreaterThan(range(sample(0.05 * (0.4 + 0.25 * 1.6), 0.12)) * 2.5);
  });
  it("sits in the water, never on it: the keel is under the surface and the deck stands exactly the freeboard clear, in every weather", () => {
    for (const [amp, wind] of [[0.025, 0.12], [0.08, 0.55], [0.155, 1]] as const) {
      for (const port of PORTS) {
        const m = mooringFor(port);
        for (let t = 0; t < 60; t += 0.37) {
          const keel = boatRideHeight(m.x, m.z, t, amp, wind);
          const water = waveHeight(m.x, m.z, t, amp, wind);
          expect(keel).toBeLessThan(water); // not hovering
          expect(keel + HULL_HEIGHT - water).toBeCloseTo(HULL_FREEBOARD, 9); // not swamped
        }
      }
    }
  });
  it("shows a good part of the 0.34 tall hull above the water, not a sliver", () => {
    expect(HULL_FREEBOARD).toBeGreaterThanOrEqual(0.12);
    expect(HULL_FREEBOARD).toBeLessThan(HULL_HEIGHT);
    expect(HULL_FREEBOARD / HULL_HEIGHT).toBeGreaterThan(0.5);
  });
});
