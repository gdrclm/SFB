import { describe, expect, it } from "vitest";
import { approachState, nearestInCurrentLane, requiredSpeed } from "./PlatformReadability";

describe("platform readability", () => {
  it("uses the same integer threshold for the displayed number and the actual platform", () => {
    expect(requiredSpeed(7.1)).toBe(8);
    expect(approachState(7.99, 7.1)).toBe("close");
    expect(approachState(8, 7.1)).toBe("breakable");
    expect(approachState(9, 10)).toBe("close");
    expect(approachState(7, 10)).toBe("hard");
    expect(approachState(5, 10)).toBe("danger");
  });

  it("selects only the nearest obstacle under the ball, never recommending another lane", () => {
    const platform = (x: number, y: number, width = 1, isActive = true) => ({
      mesh: { position: { x, y } }, width, isActive,
    });
    const adjacent = platform(3, 3);
    const closest = platform(0, 1);
    const lower = platform(0, -3);
    const above = platform(0, 8);
    const inactive = platform(0, 3, 1, false);
    expect(nearestInCurrentLane([adjacent, lower, closest, above, inactive], { x: 0, y: 4 }, 0.5)).toBe(closest);
    expect(nearestInCurrentLane([adjacent], { x: 0, y: 4 }, 0.5)).toBeNull();
    expect(nearestInCurrentLane([adjacent, closest], { x: 3, y: 4 }, 0.5)).toBe(adjacent);
  });
});
