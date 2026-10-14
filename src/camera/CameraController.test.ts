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
  it("uses the logarithmic GDD camera-size formula without a speed cap", () => {
    expect(calculateCameraSize(10, gameConfig.camera)).toBe(6);
    expect(calculateCameraSize(20, gameConfig.camera)).toBeCloseTo(
      6 + 2.2 * Math.log(2),
      10,
    );
    expect(calculateCameraSize(10_000, gameConfig.camera)).toBeGreaterThan(
      calculateCameraSize(1_000, gameConfig.camera),
    );
  });

  it("smoothly follows the falling ball and keeps it inside the safe view area", () => {
    const { controller, rig, target } = createFixture();

    target.position.y = 4;
    controller.fixedUpdate(1 / 60);
    expect(rig.position.y).toBeGreaterThan(4);
    expect(rig.position.y).toBeLessThan(4.5);

    target.position.y = -20;
    controller.fixedUpdate(1 / 60);
    const safeOffset =
      controller.orthographicSize * gameConfig.camera.safeVerticalRatio;
    expect(Math.abs(target.position.y - rig.position.y) - safeOffset).toBeLessThan(
      1e-10,
    );
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

  it("zooms out immediately on Boost and returns in three real seconds", () => {
    const { camera, controller } = createFixture(0.5);
    const portraitBaseline = Number(camera.orthoTop);

    controller.playBoostReaction();

    expect(controller.orthographicSize).toBe(
      gameConfig.camera.orthographicSize +
        gameConfig.camera.boostZoomExtraSize,
    );
    expect(camera.orthoTop).toBe(
      portraitBaseline + gameConfig.camera.boostZoomExtraSize,
    );

    for (let step = 0; step < 90; step += 1) {
      controller.fixedUpdate(1 / 600, 1 / 60);
    }
    expect(controller.orthographicSize).toBeGreaterThan(
      gameConfig.camera.orthographicSize,
    );
    expect(controller.orthographicSize).toBeLessThan(
      gameConfig.camera.orthographicSize +
        gameConfig.camera.boostZoomExtraSize,
    );

    for (let step = 0; step < 90; step += 1) {
      controller.fixedUpdate(1 / 600, 1 / 60);
    }
    expect(controller.orthographicSize).toBeCloseTo(
      gameConfig.camera.orthographicSize,
      10,
    );
    expect(camera.orthoTop).toBeCloseTo(portraitBaseline, 10);
  });
});
