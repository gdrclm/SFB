import { expect, it } from "vitest";
import { ComboVisibility } from "./ComboVisibility";
it("starts hidden, stays visible for two active seconds and refreshes on another hit", () => {
  const visibility = new ComboVisibility();
  expect(visibility.visible).toBe(false);
  visibility.show(); visibility.advance(1.5);
  expect(visibility.visible).toBe(true);
  visibility.show(); visibility.advance(1.5);
  expect(visibility.visible).toBe(true);
  visibility.advance(.5);
  expect(visibility.visible).toBe(false);
  visibility.show(); visibility.reset();
  expect(visibility.visible).toBe(false);
});
