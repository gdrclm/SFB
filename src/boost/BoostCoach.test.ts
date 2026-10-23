import { expect, it } from "vitest";
import { BoostCoach } from "./BoostCoach";
it("waits for repeated mistakes and permission to teach, expires and never nags twice", () => {
  const coach = new BoostCoach();
  coach.failedImpact(); coach.fixedUpdate(1, true); expect(coach.visible).toBe(false);
  coach.failedImpact(); coach.fixedUpdate(1, false); expect(coach.visible).toBe(false);
  coach.fixedUpdate(.1, true); expect(coach.visible).toBe(true);
  coach.fixedUpdate(10, true); expect(coach.visible).toBe(false);
  coach.failedImpact(); coach.fixedUpdate(.1, true); expect(coach.visible).toBe(false);
});
it("recognizes a player already using BOOST and supports dismiss", () => {
  const coach = new BoostCoach();
  coach.failedImpact(); coach.boosted(); coach.failedImpact();
  coach.fixedUpdate(1, true); expect(coach.visible).toBe(false);
  coach.failedImpact(); coach.fixedUpdate(1, true); expect(coach.visible).toBe(true);
  coach.dismiss(); expect(coach.visible).toBe(false);
});

it("never explains in a normal run and immediately dismisses when teaching ends", () => {
  const coach = new BoostCoach();
  for (let i = 0; i < 10; i++) { coach.failedImpact(); coach.fixedUpdate(1, false); }
  expect(coach.visible).toBe(false);
  coach.fixedUpdate(.01, true); expect(coach.visible).toBe(true);
  coach.fixedUpdate(.01, false); expect(coach.visible).toBe(false);
});
