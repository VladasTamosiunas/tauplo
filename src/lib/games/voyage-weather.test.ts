import { describe, expect, it } from "vitest";
import type { Weather } from "./schema";
import { applyWeather, weatherLook } from "./voyage-weather";
import { skyForSeason } from "./voyage-scene-model";

const ORDER: Weather[] = ["calm", "rough", "storm"];

describe("weatherLook: each weather is a real step up from the one before", () => {
  it("rain, waves, clouds and wind all increase from calm to rough to storm", () => {
    for (const key of ["rain", "waveHeight", "cloud", "wind"] as const) {
      const [calm, rough, storm] = ORDER.map((w) => weatherLook(w)[key]);
      expect(rough, key).toBeGreaterThan(calm);
      expect(storm, key).toBeGreaterThan(rough);
    }
  });
  it("light and visibility fall from calm to rough to storm", () => {
    const [calm, rough, storm] = ORDER.map((w) => weatherLook(w));
    expect(rough.light).toBeLessThan(calm.light);
    expect(storm.light).toBeLessThan(rough.light);
    expect(rough.visibility).toBeLessThan(calm.visibility);
    expect(storm.visibility).toBeLessThan(rough.visibility);
  });
  it("only a storm has lightning, and calm weather has no rain at all", () => {
    expect(weatherLook("calm").lightning).toBe(0);
    expect(weatherLook("rough").lightning).toBe(0);
    expect(weatherLook("storm").lightning).toBeGreaterThan(0);
    expect(weatherLook("calm").rain).toBe(0);
  });
  it("every value is a finite number in a sane range", () => {
    for (const w of ORDER) {
      const l = weatherLook(w);
      for (const [k, n] of Object.entries(l)) {
        expect(Number.isFinite(n), `${w}.${k}`).toBe(true);
        expect(n, `${w}.${k}`).toBeGreaterThanOrEqual(0);
        expect(n, `${w}.${k}`).toBeLessThanOrEqual(1.5);
      }
    }
  });
});

describe("applyWeather: dims the season's sky without erasing the season", () => {
  const summer = skyForSeason(1.2);
  const winter = skyForSeason(0.15);

  it("leaves calm weather exactly as the season is", () => {
    expect(applyWeather(summer, "calm")).toEqual(summer);
  });
  it("makes a storm darker than rough, and rough darker than calm, in the sky", () => {
    const lum = (c: [number, number, number]) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    const [c, r, s] = ORDER.map((w) => lum(applyWeather(summer, w).top));
    expect(r).toBeLessThan(c);
    expect(s).toBeLessThan(r);
  });
  it("thickens the fog and lowers the sun as the weather worsens", () => {
    const [c, r, s] = ORDER.map((w) => applyWeather(summer, w));
    expect(r.fogDensity).toBeGreaterThan(c.fogDensity);
    expect(s.fogDensity).toBeGreaterThan(r.fogDensity);
    expect(s.sunHeight).toBeLessThan(c.sunHeight);
  });
  it("keeps a summer storm warmer-looking than a winter storm: the season still shows through", () => {
    const sTop = applyWeather(summer, "storm").top;
    const wTop = applyWeather(winter, "storm").top;
    expect(sTop[2]).not.toBeCloseTo(wTop[2], 2);
  });
  it("never produces a colour channel outside 0 to 1, nor a negative fog or sun", () => {
    for (const look of [summer, winter]) {
      for (const w of ORDER) {
        const a = applyWeather(look, w);
        for (const c of [a.top, a.horizon, a.sun, a.waterTint]) for (const n of c) {
          expect(n).toBeGreaterThanOrEqual(0);
          expect(n).toBeLessThanOrEqual(1);
        }
        expect(a.fogDensity).toBeGreaterThan(0);
        expect(a.sunHeight).toBeGreaterThanOrEqual(0);
      }
    }
  });
  it("does not modify the look it was given", () => {
    const before = JSON.stringify(summer);
    applyWeather(summer, "storm");
    expect(JSON.stringify(summer)).toBe(before);
  });
});
