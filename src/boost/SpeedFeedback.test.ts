import { describe, expect, it } from "vitest";
import { calculateSpeedFeedback } from "./SpeedFeedback";

describe("speed feedback", () => {
  it("keeps wind off at rest and ramps without saturating after early boosts", () => {
    expect(calculateSpeedFeedback(10).opacity).toBe(0);
    const slow = calculateSpeedFeedback(20), fast = calculateSpeedFeedback(80), maximum = calculateSpeedFeedback(320);
    expect(slow.opacity).toBeGreaterThan(.1);
    expect(slow.opacity).toBeLessThan(.35);
    expect(fast.opacity).toBeGreaterThan(slow.opacity);
    expect(maximum.opacity).toBeGreaterThan(fast.opacity);
    expect(maximum.power).toBe(1);
    expect(calculateSpeedFeedback(Number.NaN).opacity).toBe(0);
  });

  it("makes movement faster and clearer beyond the second and third boosts", () => {
    const speeds = [10, 15, 20, 25, 30, 40, 60];
    for (let i = 1; i < speeds.length; i++) {
      const before = calculateSpeedFeedback(speeds[i - 1] ?? 0);
      const after = calculateSpeedFeedback(speeds[i] ?? 0);
      expect(after.duration).toBeLessThan(before.duration);
      expect(after.opacity).toBeGreaterThan(before.opacity);
      expect(after.length).toBeGreaterThan(before.length);
      expect(after.width).toBeGreaterThan(before.width);
      expect(after.lanes).toBeGreaterThan(before.lanes);
    }
  });
});

it("adds mobile lanes past early boosts and keeps all values finite at invalid inputs", () => {
  const mobileLanes = (speed: number): number => [0, 2, 4, 6, 8, 10].filter(lane => calculateSpeedFeedback(speed).lanes > lane).length;
  expect(mobileLanes(10)).toBe(0);
  expect(mobileLanes(20)).toBeLessThan(mobileLanes(80));
  expect(mobileLanes(80)).toBeLessThan(mobileLanes(320));
  for (const speed of [NaN, Infinity, -10, 0, 1e12]) {
    expect(Object.values(calculateSpeedFeedback(speed)).every(Number.isFinite)).toBe(true);
  }
});
