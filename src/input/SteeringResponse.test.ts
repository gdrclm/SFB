import { expect, it } from "vitest";
import { steeringSpeedScale, steeringWidthScale } from "./SteeringResponse";

it("preserves the opening and first boost, then smoothly raises swipe response to 1.5x", () => {
  expect(steeringSpeedScale(0, 10)).toBe(1);
  expect(steeringSpeedScale(10, 10)).toBe(1);
  expect(steeringSpeedScale(15, 10)).toBe(1);
  expect(steeringSpeedScale(20, 10)).toBe(1);
  expect(steeringSpeedScale(22.5, 10)).toBeGreaterThan(1);
  expect(steeringSpeedScale(22.5, 10)).toBeLessThan(1.02);
  expect(steeringSpeedScale(40, 10)).toBe(1.25);
  expect(steeringSpeedScale(60, 10)).toBe(1.5);
  expect(steeringSpeedScale(6000, 10)).toBe(1.5);
  expect(steeringSpeedScale(10, 0)).toBe(1);
  expect(steeringSpeedScale(NaN, 10)).toBe(1);
});

it("does not amplify a wide starting viewport and gradually enables expansion compensation", () => {
  for (const width of [1, 4, 10]) {
    for (const speed of [10, 15, 20]) expect(steeringWidthScale(width, speed, 10)).toBe(1);
  }
  expect(steeringWidthScale(4, 20.001, 10)).toBeCloseTo(1, 7);
  expect(steeringWidthScale(4, 40, 10)).toBe(2.5);
  expect(steeringWidthScale(4, 60, 10)).toBe(4);
  expect(steeringWidthScale(4, 6000, 10)).toBe(4);
  expect(steeringWidthScale(NaN, 40, 10)).toBe(1);
});
