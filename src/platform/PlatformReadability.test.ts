import { describe, expect, it } from "vitest";
import { approachSymbol, approachState, nearestInCurrentLane, requiredSpeed } from "./PlatformReadability";

describe("platform readability", () => {
  it("uses the same integer threshold for the displayed number and the actual platform", () => {
    expect(requiredSpeed(7.1)).toBe(8);
    expect(approachState(7.99, 7.1)).toBe("boost");
    expect(approachState(8, 7.1)).toBe("breakable");
    expect(approachState(9, 10)).toBe("boost");
    expect(approachState(7, 10)).toBe("boost");
    expect(approachState(5, 10)).toBe("neutral");
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

it("gives a direct visual decision instead of requiring arithmetic", () => {
  expect(approachSymbol(approachState(12, 12))).toBe("");
  expect(approachSymbol(approachState(10, 15))).toBe("ϟ");
  expect(approachSymbol(approachState(10, 16, true, 1.5, .5))).toBe("!");
  expect(approachSymbol(null)).toBe("");
});

it("never recommends an unavailable boost, and distinguishes waiting from an impossible break", () => {
  expect(approachSymbol(approachState(10, 14, true))).toBe("ϟ");
  expect(approachSymbol(approachState(10, 14, false))).toBe("");
  expect(approachSymbol(approachState(10, 16, false))).toBe("");
  expect(approachSymbol(approachState(16, 16, false))).toBe("");
  expect(approachState(10, 16, true, 2)).not.toBe("danger");
});

it("warns conservatively when the ball straddles two platforms in the same row", () => {
  const safe = { isActive: true, width: 1, strength: 5, mesh: { position: { x: -.45, y: -2 } } };
  const danger = { isActive: true, width: 1, strength: 30, mesh: { position: { x: .45, y: -2 } } };
  expect(nearestInCurrentLane([safe, danger], { x: 0, y: 1 }, .4)).toBe(danger);
  expect(nearestInCurrentLane([safe, danger], { x: -.6, y: 1 }, .4)).toBe(safe);
});

it("keeps distant threats neutral and reserves red for a real imminent failure", () => {
  expect(approachState(10, 16, true, 1.5, 1.2)).toBe("neutral");
  expect(approachState(10, 16, true, 1.5, .7)).toBe("danger");
  expect(approachState(10, 14, false, 1.5, .7)).toBe("danger");
  expect(approachState(10, 14, true, 1.5, .7)).toBe("boost");
  expect(approachState(14, 14, false, 1.5, .7)).toBe("breakable");
  expect(approachSymbol(approachState(10, 16))).toBe("");
});
