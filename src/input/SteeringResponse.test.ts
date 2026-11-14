import { expect, it } from "vitest";
import { steeringWidthScale } from "./SteeringResponse";

it("does not amplify a wide starting viewport and gradually enables expansion compensation", () => {
  for (const width of [1, 4, 10]) {
    for (const speed of [10, 15, 20]) expect(steeringWidthScale(width, speed, 10)).toBe(1);
  }
  expect(steeringWidthScale(4, 20.001, 10)).toBeCloseTo(1, 7);
  expect(steeringWidthScale(4, 40, 10)).toBe(2.125);
  expect(steeringWidthScale(4, 60, 10)).toBe(3.25);
  expect(steeringWidthScale(4, 6000, 10)).toBe(3.25);
  expect(steeringWidthScale(NaN, 40, 10)).toBe(1);
  expect(steeringWidthScale(4, NaN, 10)).toBe(1);
  expect(steeringWidthScale(4, 40, 0)).toBe(1);
});
