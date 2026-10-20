import { describe, expect, it } from "vitest";
import { gameConfig } from "../config/gameConfig";
import { CameraController, calculateCameraSize } from "./CameraController";

function createFixture(aspectRatio = 16 / 9) {
  const camera = {
    orthoTop: null,
    orthoBottom: null,
    orthoLeft: null,
    orthoRight: null,
  };
  const rig = { position: { y: 0 } };
  const target = {
    position: { y: gameConfig.ball.startPosition.y },
    fallSpeed: gameConfig.ball.startFallSpeed,
  };
  const controller = new CameraController(
    camera,
    rig,
    target,
    () => aspectRatio,
    gameConfig,
  );

  return { camera, rig, target, controller };
}

describe("CameraController", () => {
  it("scales visible height with the square root of speed without a cap", () => {
    expect(calculateCameraSize(10, gameConfig.camera)).toBe(6);
    expect(calculateCameraSize(20, gameConfig.camera)).toBeCloseTo(
      6 * Math.sqrt(2),
      10,
    );
    expect(calculateCameraSize(10_000, gameConfig.camera)).toBeGreaterThan(
      calculateCameraSize(1_000, gameConfig.camera),
    );
  });

  it.each([9 / 19.5, 16 / 9])("keeps zooming on successive boosts at aspect %s without cancelling perceived acceleration", (aspect) => {
    const { camera, controller, target } = createFixture(aspect);
    let previousHeight = Number(camera.orthoTop) * 2;
    for (let boost = 0; boost < 5; boost++) {
      target.fallSpeed *= gameConfig.boost.speedMultiplier;
      controller.playBoostReaction();
      for (let frame = 0; frame < 240; frame++) controller.fixedUpdate(1 / 60);
      const height = Number(camera.orthoTop) * 2;
      expect(height / previousHeight).toBeCloseTo(Math.sqrt(1.5), 5);
      // Distance travelled per screen-height must still rise after each boost.
      expect(1.5 / (height / previousHeight)).toBeGreaterThan(1.2);
      previousHeight = height;
    }
  });

  it.each([9 / 19.5, 16 / 9])("keeps the falling ball above centre and preserves the decision space at aspect %s", (aspect) => {
    const { controller, camera, rig, target } = createFixture(aspect);
    controller.setBallScreenRatio(.37);
    for (let frame = 0; frame < 180; frame++) {
      target.position.y -= target.fallSpeed / 60;
      controller.fixedUpdate(1 / 60);
      const halfHeight = Number(camera.orthoTop);
      const screenRatio = .5 - (target.position.y - rig.position.y) / (halfHeight * 2);
      expect(screenRatio).toBeGreaterThanOrEqual(.345);
      expect(screenRatio).toBeLessThanOrEqual(.396);
    }
    target.position.y -= 100;
    controller.fixedUpdate(1 / 60);
    const ratio = .5 - (target.position.y - rig.position.y) / (Number(camera.orthoTop) * 2);
    expect(ratio).toBeLessThan(.4);
  });

  it("adapts framing to the free area after rotation without changing world proportions", () => {
    const { controller, camera, target, rig } = createFixture(.5);
    controller.setBallScreenRatio(.43);
    for (let frame = 0; frame < 120; frame++) controller.fixedUpdate(1 / 60);
    expect(.5 - (target.position.y - rig.position.y) / (Number(camera.orthoTop) * 2)).toBeCloseTo(.43, 6);
    expect((Number(camera.orthoRight) - Number(camera.orthoLeft)) / (Number(camera.orthoTop) * 2)).toBe(.5);
  });

  it("zooms out smoothly as speed grows without modifying ball speed", () => {
    const { controller, target } = createFixture();
    target.fallSpeed = 100;
    const targetSize = calculateCameraSize(target.fallSpeed, gameConfig.camera);

    controller.fixedUpdate(1 / 60);
    expect(controller.orthographicSize).toBeGreaterThan(6);
    expect(controller.orthographicSize).toBeLessThan(targetSize);
    expect(target.fallSpeed).toBe(100);

    for (let step = 0; step < 600; step += 1) {
      controller.fixedUpdate(1 / 60);
    }
    expect(controller.orthographicSize).toBeCloseTo(targetSize, 8);
  });

  it("provides a separate smooth zoom behavior for a phase transition", () => {
    const { controller } = createFixture();
    controller.setPhaseTransitionActive(true);

    controller.fixedUpdate(1 / 60);
    expect(controller.behavior).toBe("phase-transition");
    expect(controller.orthographicSize).toBeGreaterThan(6);
    expect(controller.orthographicSize).toBeLessThan(
      6 + gameConfig.camera.phaseTransitionExtraSize,
    );

    for (let step = 0; step < 600; step += 1) {
      controller.fixedUpdate(1 / 60);
    }
    expect(controller.orthographicSize).toBeCloseTo(
      6 + gameConfig.camera.phaseTransitionExtraSize,
      8,
    );

    controller.setPhaseTransitionActive(false);
    for (let step = 0; step < 600; step += 1) {
      controller.fixedUpdate(1 / 60);
    }
    expect(controller.behavior).toBe("gameplay");
    expect(controller.orthographicSize).toBeCloseTo(6, 8);
  });

  it("keeps the full horizontal play space visible on a portrait viewport", () => {
    const { camera } = createFixture(0.5);

    expect(camera.orthoTop).toBe(10);
    expect(camera.orthoBottom).toBe(-10);
    expect(camera.orthoLeft).toBe(-5);
    expect(camera.orthoRight).toBe(5);
  });

  it("preserves world proportions for portrait and landscape viewports", () => {
    for (const aspectRatio of [9 / 19.5, 16 / 9]) {
      const { camera } = createFixture(aspectRatio);
      const width = Number(camera.orthoRight) - Number(camera.orthoLeft);
      const height = Number(camera.orthoTop) - Number(camera.orthoBottom);

      expect(width / height).toBeCloseTo(aspectRatio, 10);
    }
  });

  it("preserves the current view when another boost interrupts its camera reaction", () => {
    const { camera, controller, target } = createFixture(.5);
    target.fallSpeed *= 1.5;
    controller.playBoostReaction();
    for (let frame = 0; frame < 30; frame++) controller.fixedUpdate(1 / 60);
    const currentView = Number(camera.orthoTop);

    target.fallSpeed *= 1.5;
    controller.playBoostReaction();
    expect(Number(camera.orthoTop)).toBe(currentView);
    controller.fixedUpdate(.1, .1);
    expect(Number(camera.orthoTop)).toBe(currentView);
    for (let frame = 0; frame < 240; frame++) controller.fixedUpdate(1 / 60);
    expect(controller.orthographicSize).toBeCloseTo(calculateCameraSize(target.fallSpeed, gameConfig.camera), 5);
  });

  it("lets the initial boost travel read before zooming, then returns over real time", () => {
    const { camera, controller, target } = createFixture(.5);
    const baseline = Number(camera.orthoTop);
    target.fallSpeed *= 1.5;
    controller.playBoostReaction();
    expect(Number(camera.orthoTop)).toBe(baseline);
    controller.fixedUpdate(.1, .1);
    expect(Number(camera.orthoTop)).toBe(baseline);
    controller.fixedUpdate(.1, .1);
    controller.fixedUpdate(.1, .1);
    expect(Number(camera.orthoTop)).toBeGreaterThan(baseline);
    for (let i = 0; i < 600; i++) controller.fixedUpdate(1 / 60, 1 / 60);
    expect(controller.orthographicSize).toBeCloseTo(calculateCameraSize(target.fallSpeed, gameConfig.camera), 8);
  });
});
