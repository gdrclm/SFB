import { describe, expect, it } from "vitest";
import { IDLE_ATLAS_SIZE, IDLE_FRAME_COUNT, idleFrame, idlePhase, idleSpriteRect } from "./PlatformIdle";
import { platformSpriteSlices } from "./PlatformSpriteLayout";

describe("twelve-frame platform idle", () => {
  it("plays all twelve poses once per second and loops from 11 to 0", () => {
    const frames = Array.from({ length: 12 }, (_, frame) => idleFrame(frame / 12));
    expect(frames).toEqual(Array.from({ length: 12 }, (_, frame) => frame));
    expect(idleFrame(.999)).toBe(11);
    expect(idleFrame(1)).toBe(0);
    for (let frame = 0; frame < 12; frame++) expect(idleFrame(30 + frame / 12)).toBe(frame);
  });

  it("freezes a supplied clock and fixes reduced-motion/invalid clocks to the first pose", () => {
    const phase = idlePhase("platform-low");
    for (const time of [0, -1, NaN, Infinity]) expect(idleFrame(time, phase)).toBe(0);
    expect(idlePhase("platform-low")).toBe(phase);
    expect(new Set(Array.from({ length: 12 }, (_, i) => idlePhase(`platform-${String(i)}`))).size).toBeGreaterThan(1);
  });

  it("has twelve distinct rectangles per material, stable cell sizes and no adjacent-cell sampling", () => {
    for (const row of [0, 1, 2, 3, 4] as const) {
      const frames = Array.from({ length: IDLE_FRAME_COUNT }, (_, frame) => idleSpriteRect(row, frame));
      expect(new Set(frames.map(rect => rect.x)).size).toBe(12);
      for (const [frame, rect] of frames.entries()) {
        expect(rect.width).toBe(frames[0]?.width); expect(rect.height).toBe(frames[0]?.height);
        expect(rect.x).toBeGreaterThanOrEqual(0); expect(rect.y).toBeGreaterThanOrEqual(0);
        expect(rect.x + rect.width).toBeLessThan(IDLE_ATLAS_SIZE.width);
        expect(rect.y + rect.height).toBeLessThan(IDLE_ATLAS_SIZE.height);
        if (frame > 0) expect(rect.x).toBeGreaterThan((frames[frame - 1]?.x ?? 0) + rect.width);
        for (const slice of platformSpriteSlices(7.5, rect)) {
          expect(slice.rect.x).toBeGreaterThanOrEqual(rect.x);
          expect(slice.rect.x + slice.rect.width).toBeLessThanOrEqual(rect.x + rect.width + 1e-8);
        }
      }
      expect(idleSpriteRect(row, 12)).toEqual(frames[0]);
    }
  });
});
