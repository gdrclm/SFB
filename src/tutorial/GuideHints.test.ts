import { expect, it } from "vitest";
import { guideHint } from "./GuideHints";
it("teaches the actual controls for each input device with one brief action", () => {
  expect(guideHint("platform", "desktop")?.text).toContain("курсор");
  expect(guideHint("platform", "touch")?.text).toContain("Свайпай");
  expect(guideHint("boost", "desktop")?.text).toContain("ПКМ");
  expect(guideHint("annihilation", "desktop")?.text).toContain("Пробел");
  expect(guideHint("annihilation", "touch")?.text).toContain("Нажми");
  expect(guideHint("annihilation", "touch")?.target).toBe("#slow-mode-button");
  expect(guideHint("coin", "touch")?.text).toContain("ускоряют");
  expect(guideHint("vitality", "touch")?.text).toContain("+1 жизнь");
  expect(guideHint("fork", "touch")?.text).toContain("опасно");
  expect(guideHint("free", "touch")).toBe(null);
});
