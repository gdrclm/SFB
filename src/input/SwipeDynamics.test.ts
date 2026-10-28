import { expect, it } from "vitest";
import { SwipeDynamics } from "./SwipeDynamics";

function gesture(distance: number, duration: number, hz: number) {
  const response = new SwipeDynamics(); response.reset(0);
  const count = Math.max(1, Math.round(duration / 1000 * hz));
  let travel = 0;
  for (let i = 1; i <= count; i++) {
    const effort = response.record(distance / count, i * duration / count);
    travel += distance / count * (.75 + 1.25 * effort);
  }
  return { travel, effort: response.effort(duration) };
}
it("distinguishes slow dragging, tiny flicks and committed fast swipes across event rates", () => {
  const fastTravel: number[] = [];
  for (const hz of [60, 120, 240]) {
    const fast = gesture(.3, 80, hz);
    const slow = gesture(.3, 1200, hz);
    const tiny = gesture(.005, 8, hz);
    expect(fast.effort).toBe(1);
    expect(slow.effort).toBe(0);
    expect(tiny.effort).toBe(0);
    expect(fast.travel).toBeGreaterThan(slow.travel * 2);
    fastTravel.push(fast.travel);
  }
  expect(Math.max(...fastTravel) - Math.min(...fastTravel)).toBeLessThan(.035);
});
it("does not bank strength across reversals, long pauses or a fresh touch", () => {
  const response = new SwipeDynamics(); response.reset(0);
  response.record(.2, 40); expect(response.effort(40)).toBe(1);
  expect(response.record(-.003, 56)).toBe(0);
  response.record(-.2, 90); expect(response.effort(90)).toBe(1);
  expect(response.effort(350)).toBe(0);
  expect(response.record(-.002, 400)).toBe(0);
  response.reset(420); expect(response.effort(420)).toBe(0);
});
