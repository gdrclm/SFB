import { describe, expect, it } from "vitest";
import { calculateSpeedFeedback } from "./SpeedFeedback";

describe("speed feedback", () => {
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
