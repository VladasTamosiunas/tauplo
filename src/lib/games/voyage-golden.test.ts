import { describe, expect, it } from "vitest";
import golden from "./__golden__/voyage-golden.json";
import { getVoyage } from "./catalog";
import { replayVoyage } from "./voyage-engine";
import { GOLDEN_PICKS, GOLDEN_SLUGS, project } from "./voyage-golden.shared";

/**
 * Runs saved before a rule existed must replay to the same result. These twelve results (four years, three styles of
 * play) were recorded from the engine BEFORE the term deposit and market rules, and picks that use neither must keep
 * reproducing them exactly. If a rule change makes one of these fail, old saved runs would now be scored differently.
 */
describe("old picks replay to the results recorded before the deposit and market rules", () => {
  const pinned = golden as Record<string, ReturnType<typeof project>>;

  it("has a pinned result for every year and every style", () => {
    expect(Object.keys(pinned)).toHaveLength(GOLDEN_SLUGS.length * Object.keys(GOLDEN_PICKS).length);
  });

  for (const slug of GOLDEN_SLUGS) {
    for (const [style, make] of Object.entries(GOLDEN_PICKS)) {
      it(`${slug} (${style}) is unchanged`, () => {
        expect(project(replayVoyage(getVoyage(slug)!, make()))).toEqual(pinned[`${slug}::${style}`]);
      });
    }
  }
});
