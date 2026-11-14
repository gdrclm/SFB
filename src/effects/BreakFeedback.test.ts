import { expect, it } from "vitest";
import { breakFeedback } from "./BreakFeedback";

it("reserves the contact hold for risky successful hits beyond the opening speed", () => {
  expect(breakFeedback(50, 48)).toMatchObject({ perfect: true, holdSeconds: .065 });
  for (const [speed, strength] of [[10, 10], [50, 10], [50, 51]] as const) {
    expect(breakFeedback(speed, strength).holdSeconds).toBe(0);
  }
  expect(breakFeedback(50, 48, false).perfect).toBe(false);
});

it("gives fast destruction larger debris, wider travel and a quicker fracture than low speed", () => {
  const low = breakFeedback(12, 10), fast = breakFeedback(120, 10);
  expect(low.fragments).toBe(5); expect(fast.fragments).toBe(6);
  expect(low.spread).toBeGreaterThanOrEqual(78);
  expect(fast.spread).toBeGreaterThan(low.spread);
  expect(fast.durationScale).toBeLessThan(low.durationScale);
  expect(fast.force).toBeGreaterThan(low.force);
  for (const speed of [0, NaN, Infinity, -1, 1e12]) {
    const profile = breakFeedback(speed, 10);
    expect(profile.spread).toBeLessThanOrEqual(120);
    expect(Number.isFinite(profile.force)).toBe(true);
  }
});
