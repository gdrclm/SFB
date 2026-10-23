import { expect, it, vi } from "vitest";
import { PowerUpController } from "./PowerUpController";
const options = { impactRetention: 0, dangerRange: 0, annihilation: true, plasma: true };
it("does not consume blocked abilities and grants only one activation per run", () => {
  let playing = false;
  const activate = vi.fn(), sweep = vi.fn();
  const ball = { position: { x: 0, y: 0 }, fallSpeed: 10 };
  const power = new PowerUpController(options, ball, () => playing, activate, sweep);
  expect(power.tryActivate("plasma")).toBe(false);
  expect(power.available("plasma")).toBe(true);
  playing = true;
  expect(power.tryActivate("plasma")).toBe(true);
  expect(power.tryActivate("plasma")).toBe(false);
  expect(activate).toHaveBeenCalledTimes(1);
  expect(new PowerUpController(options, ball, () => true, activate, sweep).available("plasma")).toBe(true);
});
it("ramps speed and grants exactly 30 active real seconds even during slow motion", () => {
  const ball = { position: { x: 0, y: 0 }, fallSpeed: 10 };
  const power = new PowerUpController(options, ball, () => true, vi.fn(), vi.fn());
  power.tryActivate("plasma");
  power.fixedUpdate(.1, .3);
  expect(ball.fallSpeed).toBeGreaterThan(10);
  expect(ball.fallSpeed).toBeLessThan(180);
  power.fixedUpdate(.2, .6);
  expect(ball.fallSpeed).toBeCloseTo(180);
  ball.fallSpeed = 195; power.fixedUpdate(.1, .1);
  expect(ball.fallSpeed).toBe(195); // Collected coins are never overwritten by the speed floor.
  power.fixedUpdate(0, 0);
  expect(power.plasmaRemaining).toBeCloseTo(29);
  power.fixedUpdate(9, 28.99);
  expect(power.invulnerable).toBe(true);
  power.fixedUpdate(.01, .01);
  expect(power.invulnerable).toBe(false);
  expect(power.tryActivate("plasma")).toBe(false);
});
it("keeps the 200m annihilation sphere fixed and clears streamed objects until the player leaves it", () => {
  const ball = { position: { x: 2, y: -5 }, fallSpeed: 10 };
  const sweep = vi.fn();
  const power = new PowerUpController(options, ball, () => true, vi.fn(), sweep);
  expect(power.tryActivate("annihilation")).toBe(true);
  expect(sweep).toHaveBeenCalledTimes(1);
  expect(power.covers({ x: 2, y: -205 })).toBe(true);
  expect(power.covers({ x: 3, y: -205 })).toBe(false);
  ball.position.y = -100; power.fixedUpdate(.1);
  expect(sweep).toHaveBeenCalledTimes(2);
  expect(power.zone).toEqual({ x: 2, y: -5 });
  ball.position.y = -206; power.fixedUpdate(.1);
  expect(power.zone).toBe(null);
});
it("does not unlock shop powers in a run without their configuration", () => {
  const power = new PowerUpController({ ...options, plasma: false, annihilation: false },
    { position: { x: 0, y: 0 }, fallSpeed: 10 }, () => true, vi.fn(), vi.fn());
  expect(power.tryActivate("annihilation")).toBe(false);
  expect(power.tryActivate("plasma")).toBe(false);
});

it("shares four charges between four screen pulses and one full-radius blast", () => {
  const activate = vi.fn(), sweep = vi.fn(), mini = vi.fn();
  const ball = { position: { x: 0, y: 0 }, fallSpeed: 10 };
  const power = new PowerUpController(options, ball, () => true, activate, sweep, mini);
  expect(power.annihilationCharges).toBe(4);
  expect(power.tryMiniAnnihilation()).toBe(true);
  expect(power.annihilationCharges).toBe(3);
  expect(power.zone).toBe(null);
  expect(power.tryActivate("annihilation")).toBe(false);
  expect(power.annihilationCharges).toBe(3);
  for (let i = 0; i < 3; i++) expect(power.tryMiniAnnihilation()).toBe(true);
  expect(power.tryMiniAnnihilation()).toBe(false);
  expect(power.available("annihilation")).toBe(false);
  expect(mini).toHaveBeenCalledTimes(4); expect(sweep).not.toHaveBeenCalled();
  const fresh = new PowerUpController(options, ball, () => true, activate, sweep, mini);
  expect(fresh.tryActivate("annihilation")).toBe(true);
  expect(fresh.annihilationCharges).toBe(0);
  expect(fresh.tryMiniAnnihilation()).toBe(false);
});
it("does not spend a mini charge when gameplay is paused or the ability is not equipped", () => {
  const ball = { position: { x: 0, y: 0 }, fallSpeed: 10 };
  const power = new PowerUpController(options, ball, () => false, vi.fn(), vi.fn(), vi.fn());
  expect(power.tryMiniAnnihilation()).toBe(false);
  expect(power.annihilationCharges).toBe(4);
  const locked = new PowerUpController({ ...options, annihilation: false }, ball, () => true, vi.fn(), vi.fn(), vi.fn());
  expect(locked.tryMiniAnnihilation()).toBe(false);
});

it("captures world coordinates from the engine's accessor-based vector rather than copying its internal fields", () => {
  class EnginePoint { get x(): number { return 7; } get y(): number { return -20; } }
  const power = new PowerUpController(options, { position: new EnginePoint(), fallSpeed: 10 }, () => true, vi.fn(), vi.fn());
  expect(power.tryActivate("annihilation")).toBe(true);
  expect(power.zone).toEqual({ x: 7, y: -20 });
  expect(power.covers({ x: 7, y: -220 })).toBe(true);
  power.fixedUpdate(.01);
  expect(power.zone).not.toBe(null);
});

it("lends annihilation for a lesson without unlocking it or changing real charges", () => {
  const config = { ...options, annihilation: false };
  const mini = vi.fn();
  const power = new PowerUpController(config, { position: { x: 0, y: 0 }, fallSpeed: 10 }, () => true, vi.fn(), vi.fn(), mini);
  power.setTutorialAnnihilation(true);
  expect(power.annihilationCharges).toBe(4);
  expect(power.tryMiniAnnihilation()).toBe(true); expect(mini).toHaveBeenCalledOnce();
  expect(config.annihilation).toBe(false);
  power.setTutorialAnnihilation(false);
  expect(power.annihilationCharges).toBe(0); expect(power.available("annihilation")).toBe(false);
  const owned = new PowerUpController(options, { position: { x: 0, y: 0 }, fallSpeed: 10 }, () => true, vi.fn(), vi.fn(), mini);
  owned.tryMiniAnnihilation(); expect(owned.annihilationCharges).toBe(3);
  owned.setTutorialAnnihilation(true); owned.tryActivate("annihilation");
  owned.setTutorialAnnihilation(false);
  expect(owned.annihilationCharges).toBe(3); expect(owned.zone).toBe(null);
});
