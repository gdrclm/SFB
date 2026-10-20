import { expect, it } from "vitest";
import { FirstSuccess } from "./FirstSuccess";
it("requires five breaks since the last life loss and completes only once", () => {
  const goal = new FirstSuccess();
  for (let i = 0; i < 4; i++) expect(goal.hit()).toBe(false);
  goal.loseLife();
  expect(goal.count).toBe(0);
  for (let i = 0; i < 4; i++) expect(goal.hit()).toBe(false);
  expect(goal.hit()).toBe(true);
  goal.loseLife();
  expect(goal.completed).toBe(true);
  expect(goal.hit()).toBe(false);
  expect(goal.count).toBe(5);
});
