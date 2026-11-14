import { expect, it } from "vitest";
import { sphereBoxFraction } from "./SphereBoxSweep";
it("handles solid faces, tangency, initial overlap and genuine rounded-corner misses", () => {
  const center = { x: 0, y: 0, z: 0 }, half = { x: 1, y: .2, z: .5 };
  const cast = (x: number, z = 0) => sphereBoxFraction({ x, y: 2, z }, { x, y: -2, z }, center, half, .5);
  expect(cast(0)).toBeCloseTo(.325);
  expect(cast(1.5)).toBeCloseTo(.45);
  expect(cast(1.51)).toBeNull();
  expect(cast(1.4, .9)).toBeNull();
  expect(sphereBoxFraction(center, center, center, half, .5)).toBe(0);
});
