import { expect, it } from "vitest";
import { FixedStepRunner } from "../core/FixedStepRunner";
import { ActiveRunClock } from "./ActiveRunClock";
it.each([60, 15, 2, 1])("counts 120 real active seconds at %s FPS despite clamped physics", fps => {
  const clock = new ActiveRunClock(); clock.reset(1000); clock.setActive(true, 1000);
  const runner = new FixedStepRunner(1 / 60, .25); let simulated = 0;
  runner.register({ fixedUpdate: dt => { simulated += dt; } });
  for (let frame = 1; frame <= 120 * fps; frame++) {
    clock.setActive(true, 1000 + frame * 1000 / fps); runner.advance(1 / fps);
  }
  expect(clock.seconds).toBeCloseTo(120, 6);
  if (fps <= 2) expect(simulated).toBeLessThanOrEqual(60.00001);
});
it("settles pause and visibility edges, excludes inactive time, and resets between runs", () => {
  const clock = new ActiveRunClock(); clock.reset(1000); clock.setActive(true, 1000);
  clock.setActive(false, 11500); expect(clock.seconds).toBe(10.5);
  clock.setActive(true, 71500); clock.setActive(false, 81000); expect(clock.seconds).toBe(20);
  clock.setActive(false, 90000); expect(clock.seconds).toBe(20);
  clock.reset(90000); clock.setActive(true, 90000); clock.setActive(true, 93000);
  expect(clock.seconds).toBe(3);
});
it("does not lose long frames or let invalid/backwards timestamps rewind the clock", () => {
  const clock = new ActiveRunClock(); clock.reset(1000); clock.setActive(true, 1000);
  clock.setActive(true, 6000); expect(clock.seconds).toBe(5);
  clock.setActive(true, NaN); clock.setActive(true, 5000); clock.setActive(false, 7000);
  expect(clock.seconds).toBe(6);
});
