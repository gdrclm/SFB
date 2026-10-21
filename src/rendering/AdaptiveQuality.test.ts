import { expect, it } from "vitest";
import { initialQuality, renderScale, QualityBudget } from "./AdaptiveQuality";
const feed = (budget: QualityBudget, fps: number, seconds: number, active = true): void => {
  for (let i = 0; i < fps * seconds; i++) budget.observe(1 / fps, active);
};
it("starts conservatively on limited memory or CPUs without requiring device APIs", () => {
  expect(initialQuality(2, 8)).toBe("low");
  expect(initialQuality(undefined, 4)).toBe("low");
  expect(initialQuality(4, 8)).toBe("medium");
  expect(initialQuality(undefined, undefined)).toBe("high");
});
it("bounds high-DPI and large-screen framebuffer allocation", () => {
  for (const tier of ["high", "medium", "low"] as const) {
    const scale = renderScale(tier, 390, 844, 3);
    expect(390 * 844 / scale ** 2).toBeLessThan(390 * 844 * 3 ** 2 * .26);
    expect(3840 * 2160 / renderScale(tier, 3840, 2160, 2) ** 2).toBeLessThanOrEqual(1_500_001);
  }
  expect(renderScale("low", 390, 844, 3)).toBeGreaterThan(renderScale("high", 390, 844, 3));
});
it("drops quality on sustained slow frames and recovers gradually after stable play", () => {
  const budget = new QualityBudget("high");
  feed(budget, 30, 12); expect(budget.tier).toBe("low");
  feed(budget, 60, 10); expect(budget.tier).toBe("low");
  feed(budget, 60, 20); expect(budget.tier).toBe("medium");
});
it("does not lower quality for a single stall, pauses or returning from the background", () => {
  const budget = new QualityBudget("high");
  feed(budget, 60, 4); budget.observe(.2, true); feed(budget, 60, 3);
  expect(budget.tier).toBe("high");
  feed(budget, 10, 10, false); budget.observe(20, false);
  feed(budget, 60, 3); expect(budget.tier).toBe("high");
});

it("still degrades under severe continuous stalls", () => {
  const budget = new QualityBudget("high");
  feed(budget, 2, 60);
  expect(budget.tier).toBe("low");
});
