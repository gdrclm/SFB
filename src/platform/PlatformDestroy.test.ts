import { expect, it } from "vitest";
import { destroySample } from "./PlatformDestroy";

it("plays destruction once with interpolation, then fades without returning to intact stone", () => {
  expect(destroySample(0)).toEqual({ frame: 0, nextFrame: 1, blend: 0, opacity: 1 });
  expect(destroySample(.5)).toMatchObject({ frame: 5, nextFrame: 6, blend: .5, opacity: 1 });
  for (const progress of [1, 1.1, 2]) expect(destroySample(progress)).toEqual({ frame: 11, nextFrame: 11, blend: 0, opacity: 0 });
  const samples = Array.from({ length: 61 }, (_, i) => destroySample(i / 60));
  expect(new Set(samples.map(s => s.frame)).size).toBe(12);
  expect(samples.every((s, i) => i === 0 || s.frame >= (samples[i - 1]?.frame ?? 0))).toBe(true);
});
