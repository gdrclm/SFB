import { describe, expect, it } from "vitest";
import { approachState } from "./PlatformReadability";
import { PLATFORM_ATLAS_SIZE, debrisSpriteRect, platformSpriteRect, platformSpriteRow, platformSpriteSlices, type PlatformSpriteRow } from "./PlatformSpriteLayout";

describe("platform sprite atlas", () => {
  it("only advertises BOOST when one available boost is enough, and red at imminent impact", () => {
    expect(platformSpriteRow("standard", approachState(10, 14, true, 1.5, .5))).toBe(1);
    expect(platformSpriteRow("standard", approachState(10, 14, false, 1.5, 1.2))).toBe(0);
    expect(platformSpriteRow("standard", approachState(10, 14, false, 1.5, .5))).toBe(2);
    expect(platformSpriteRow("super-heavy", approachState(20, 20, false))).toBe(0);
    expect(platformSpriteRow("super-heavy", null)).toBe(0);
    for (const state of [null, "breakable", "boost", "danger"] as const) {
      expect(platformSpriteRow("vitality", state)).toBe(3);
      expect(platformSpriteRow("time-slow", state)).toBe(4);
    }
  });

  it("keeps every animation and shard inside the atlas", () => {
    for (const row of [0, 1, 2, 3, 4] as const) for (let frame = 0; frame < 12; frame++) {
      for (const rect of [platformSpriteRect(row, frame), debrisSpriteRect(row, frame)]) {
        expect(rect.x).toBeGreaterThanOrEqual(0); expect(rect.y).toBeGreaterThanOrEqual(0);
        expect(rect.x + rect.width).toBeLessThanOrEqual(PLATFORM_ATLAS_SIZE.width);
        expect(rect.y + rect.height).toBeLessThanOrEqual(PLATFORM_ATLAS_SIZE.height);
      }
    }
  });

  it("covers the collision width without gaps and repeats the center on wide platforms", () => {
    for (const row of [0, 1, 2, 3, 4] as PlatformSpriteRow[]) for (const width of [.2, 1, 2.5, 7.5, 12]) {
      const slices = platformSpriteSlices(width, platformSpriteRect(row, 0));
      expect(slices[0]?.left).toBe(-width / 2);
      expect(slices.at(-1)?.right).toBe(width / 2);
      for (let i = 0; i < slices.length; i++) {
        const slice = slices[i];
        expect(slice?.right).toBeGreaterThan(slice?.left ?? 0);
        if (i > 0) expect(slice?.left).toBeCloseTo(slices[i - 1]?.right ?? 0, 8);
      }
      if (width > 3) expect(slices.length).toBeGreaterThan(3);
    }
  });
});
