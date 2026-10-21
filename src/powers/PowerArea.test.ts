import { expect, it } from "vitest";
import { intersectsScreen } from "./PowerArea";
it("clears whole partially-visible objects and preserves objects wholly outside the actual camera rectangle", () => {
  const view = { left: -5, right: 5, top: -100, bottom: -130 };
  expect(intersectsScreen(0, -115, 1, .5, view)).toBe(true);
  expect(intersectsScreen(5.5, -115, 1, .5, view)).toBe(true);
  expect(intersectsScreen(6.01, -115, 1, .5, view)).toBe(false);
  expect(intersectsScreen(0, -130.4, 1, .5, view)).toBe(true);
  expect(intersectsScreen(0, -130.51, 1, .5, view)).toBe(false);
  expect(intersectsScreen(0, -99.49, 1, .5, view)).toBe(false);
});
