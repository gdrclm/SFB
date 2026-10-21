import { expect, it } from "vitest";
import { pageProgress, sceneryRate, sceneryY } from "./BackdropMotion";

it("pushes pages through one viewport in exactly two seconds with smooth endpoints", () => {
  expect(pageProgress(0)).toBe(0);
  expect(pageProgress(1)).toBe(.5);
  expect(pageProgress(2)).toBe(1);
  expect(pageProgress(3)).toBe(1);
  expect(pageProgress(.01)).toBeLessThan(.00001);
  for (const elapsed of [0, .2, .8, 1.6, 2]) {
    const outgoing = pageProgress(elapsed) * 42;
    const incoming = (pageProgress(elapsed) - 1) * 42;
    expect(outgoing - incoming).toBeCloseTo(42); // no gap or overlap between pages
  }
});
it("keeps scenery bounded through long travel, reverses on bounce and separates depths", () => {
  expect(sceneryY(0, 10, .1)).toBeCloseTo(1);
  expect(sceneryY(0, -10, .1)).toBeCloseTo(-1);
  expect(new Set(Array.from({ length: 10 }, (_, i) => sceneryRate(i))).size).toBe(10);
  for (const travel of [-10000, 0, 500, 1000000]) {
    const y = sceneryY(15, travel, .28);
    expect(y).toBeGreaterThanOrEqual(-21);
    expect(y).toBeLessThan(21);
    expect(sceneryY(15, travel + 42 / .28, .28)).toBeCloseTo(y);
  }
});
