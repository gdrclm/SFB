import { describe, expect, it } from "vitest";
import { IDLE_ATLAS_SIZE, IDLE_FRAME_COUNT, advanceIdleTime, idleFrame, idleSample, idlePhase, idleSpriteRect } from "./PlatformIdle";
import { platformSpriteSlices } from "./PlatformSpriteLayout";

describe("twelve-frame platform idle", () => {
  it("interpolates at display rate without changing the one-second loop, including its seam", () => {
    expect(idleSample(0)).toEqual({ frame: 0, nextFrame: 1, blend: 0 });
    expect(idleSample(.5 / 12)).toEqual({ frame: 0, nextFrame: 1, blend: .5 });
    expect(idleSample(11.5 / 12)).toEqual({ frame: 11, nextFrame: 0, blend: .5 });
    for (let tick = 1; tick <= 60; tick++) {
      const sample = idleSample(tick / 60);
      const repeated = idleSample(1 + tick / 60);
      expect(repeated.frame).toBe(sample.frame);
      expect(repeated.nextFrame).toBe(sample.nextFrame);
      expect(repeated.blend).toBeCloseTo(sample.blend);
    }
    expect(new Set(Array.from({ length: 60 }, (_, tick) => idleSample(tick / 60).blend.toFixed(2))).size).toBeGreaterThan(1);
  });

  it("keeps all FX frames playing in reduced motion and freezes only while paused", () => {
    for (const reduced of [false, true]) {
      let elapsed = 0;
      const frames = new Set<number>();
      for (let i = 0; i < 120; i++) {
        elapsed = advanceIdleTime(elapsed, 1 / 60, false, reduced);
        frames.add(idleFrame(elapsed));
      }
      expect(frames.size).toBe(12);
      expect(elapsed).toBeCloseTo(reduced ? 1 : 2);
      expect(advanceIdleTime(elapsed, 5, true, reduced)).toBe(elapsed);
      expect(advanceIdleTime(elapsed, 0, false, reduced)).toBe(elapsed);
      expect(advanceIdleTime(elapsed, NaN, false, reduced)).toBe(elapsed);
      expect(advanceIdleTime(elapsed, 30, false, reduced) - elapsed).toBeCloseTo(reduced ? .05 : .1);
    }
  });

  it("plays all twelve poses once per second and loops from 11 to 0", () => {
    const frames = Array.from({ length: 12 }, (_, frame) => idleFrame(frame / 12));
    expect(frames).toEqual(Array.from({ length: 12 }, (_, frame) => frame));
    expect(idleFrame(.999)).toBe(11);
    expect(idleFrame(1)).toBe(0);
    for (let frame = 0; frame < 12; frame++) expect(idleFrame(30 + frame / 12)).toBe(frame);
  });

  it("fixes invalid clocks to the first pose and distributes platform phases", () => {
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
