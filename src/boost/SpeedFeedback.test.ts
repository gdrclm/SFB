import { describe, expect, it } from "vitest";
import { calculateSpeedFeedback } from "./SpeedFeedback";

describe("speed feedback", () => {
  it("keeps wind off at rest and ramps without saturating after early boosts", () => {
    expect(calculateSpeedFeedback(10).opacity).toBe(0);
    const slow = calculateSpeedFeedback(20), fast = calculateSpeedFeedback(80), maximum = calculateSpeedFeedback(320);
    expect(slow.opacity).toBeGreaterThan(.5);
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
      expect(after.opacity).toBeGreaterThanOrEqual(before.opacity);
    }
  });
});
