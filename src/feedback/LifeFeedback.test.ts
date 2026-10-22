import { expect, it } from "vitest";
import { LifeFeedback } from "./LifeFeedback";
function setup(reduced = false) {
  const camera = { position: { x: 0, y: 10 }, orthoTop: 6, orthoBottom: -6 };
  const overlay = { hidden: true, dataset: {} as Record<string, string> };
  const effect = new LifeFeedback(camera, overlay as unknown as HTMLElement, reduced);
  return { effect, camera, overlay };
}
it("shakes strongly in viewport units and removes offsets without corrupting camera follow", () => {
  const { effect, camera } = setup();
  effect.hit(); effect.render(1 / 60, false);
  expect(Math.hypot(camera.position.x, camera.position.y - 10)).toBeGreaterThan(.15);
  camera.position.y += 3;
  effect.removeShake(); expect(camera.position.x).toBeCloseTo(0); expect(camera.position.y).toBeCloseTo(13);
  effect.render(1 / 60, true); expect(camera.position.y).toBeCloseTo(13);
  for (let i = 0; i < 60; i++) effect.render(1 / 60, false);
  expect(camera.position.x).toBeCloseTo(0); expect(camera.position.y).toBeCloseTo(13);
});
it("holds defeat for two visible seconds and ignores pause, duplicate starts and invalid time", () => {
  const { effect } = setup(); effect.beginDefeat(); effect.render(0, false);
  for (let i = 0; i < 60; i++) effect.render(1 / 60, false);
  expect(effect.defeatReady).toBe(false); const age = effect.deathAge;
  effect.render(5, true); effect.render(NaN, false); effect.beginDefeat(); expect(effect.deathAge).toBe(age);
  for (let i = 0; i < 60; i++) effect.render(1 / 60, false);
  expect(effect.defeatReady).toBe(true);
});
it("clears critical tint after healing and disposal, and respects reduced motion without skipping defeat", () => {
  const { effect, overlay, camera } = setup(true);
  effect.setLives(1); expect(overlay.dataset.critical).toBe("true");
  effect.setLives(2); expect(overlay.dataset.critical).toBe("false");
  effect.hit(); effect.beginDefeat(); effect.render(0, false); effect.render(.1, false);
  expect(camera.position).toEqual({ x: 0, y: 10 }); expect(effect.deathAge).toBe(.1);
  effect.setLives(0); effect.dispose(); expect(overlay.hidden).toBe(true); expect(overlay.dataset.critical).toBe("false");
});

it("uses real visible time rather than stretching the defeat on slow devices", () => {
  const { effect } = setup(); effect.beginDefeat(); effect.render(.5, false);
  expect(effect.deathAge).toBe(0); // The first pose still gets its full two seconds.
  effect.render(1.5, false); expect(effect.defeatReady).toBe(false);
  effect.render(.5, false); expect(effect.defeatReady).toBe(true);
});
