import { expect, it } from "vitest";
import { steeringSpeedScale } from "./SteeringResponse";

it("raises response with fall speed and caps extreme boosts for fine control", () => {
  expect(steeringSpeedScale(0, 10)).toBe(1);
  expect(steeringSpeedScale(10, 10)).toBe(1);
  expect(steeringSpeedScale(15, 10)).toBeGreaterThan(1);
  expect(steeringSpeedScale(40, 10)).toBe(2);
  expect(steeringSpeedScale(90, 10)).toBe(3);
  expect(steeringSpeedScale(6000, 10)).toBe(3);
  expect(steeringSpeedScale(10, 0)).toBe(1);
  expect(steeringSpeedScale(NaN, 10)).toBe(1);
});
