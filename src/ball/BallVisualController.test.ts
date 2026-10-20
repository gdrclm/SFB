import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Scene } from "@babylonjs/core/scene";
import { describe, expect, it } from "vitest";
import type { SuccessfulBoostResult } from "../boost/BoostController";
import { gameConfig } from "../config/gameConfig";
import { BallVisualController } from "./BallVisualController";
import { createBallMesh } from "./createBallMesh";

function createFixture(speed = gameConfig.ball.startFallSpeed) {
  const engine = new NullEngine();
  const scene = new Scene(engine);
  const ball = createBallMesh(scene, gameConfig);
  const motion = { fallSpeed: speed };
  const controller = new BallVisualController(ball, motion, gameConfig);
  const material = ball.material;
  if (!(material instanceof StandardMaterial)) {
    throw new TypeError("Expected the ball to use StandardMaterial.");
  }

  return { engine, scene, ball, motion, controller, material };
}

function updateFor(controller: BallVisualController, seconds: number): void {
  const step = 1 / 60;
  for (let elapsed = 0; elapsed < seconds; elapsed += step) {
    controller.fixedUpdate(step);
  }
}

describe("BallVisualController", () => {
  it("creates a softly styled ball with a persistent readable outline", () => {
    const { engine, scene, ball, material } = createFixture();
    const trail = scene.getMeshByName("BallSpeedTrail");

    expect(material.specularPower).toBe(24);
    expect(material.emissiveColor.r).toBeGreaterThan(0);
    expect(ball.renderOutline).toBe(true);
    expect(ball.outlineWidth).toBe(gameConfig.ballVisual.baseOutlineWidth);
    expect(trail?.visibility).toBe(gameConfig.ballVisual.baseTrailVisibility);

    scene.dispose();
    engine.dispose();
  });

  it("smoothly stretches, brightens and strengthens the outline with speed", () => {
    const { engine, scene, ball, motion, controller, material } = createFixture();
    const baseEmissive =
      material.emissiveColor.r +
      material.emissiveColor.g +
      material.emissiveColor.b;
    const trail = scene.getMeshByName("BallSpeedTrail");
    motion.fallSpeed = 70;

    updateFor(controller, 2);

    expect(ball.scaling.y).toBeGreaterThan(1);
    expect(ball.scaling.x).toBeLessThan(1);
    expect(controller.speedIntensity).toBeGreaterThan(0.8);
    expect(
      material.emissiveColor.r +
        material.emissiveColor.g +
        material.emissiveColor.b,
    ).toBeGreaterThan(baseEmissive);
    expect(ball.outlineWidth).toBeGreaterThan(
      gameConfig.ballVisual.baseOutlineWidth,
    );
    expect(trail?.visibility).toBeGreaterThan(
      gameConfig.ballVisual.baseTrailVisibility,
    );
    expect(motion.fallSpeed).toBe(70);

    scene.dispose();
    engine.dispose();
  });

  it("keeps later equal Boost reactions just as visible as the first", () => {
    const first = createFixture();
    const later = createFixture();
    const firstBoost: SuccessfulBoostResult = {
      success: true,
      previousSpeed: 10,
      currentSpeed: 15,
      energyCost: 1,
    };
    const laterBoost: SuccessfulBoostResult = {
      success: true,
      previousSpeed: 30,
      currentSpeed: 45,
      energyCost: 3,
    };

    first.controller.playBoostReaction(firstBoost);
    later.controller.playBoostReaction(laterBoost);
    first.controller.fixedUpdate(1 / 60);
    later.controller.fixedUpdate(1 / 60);

    expect(first.ball.scaling.y).toBeCloseTo(later.ball.scaling.y, 10);

    first.scene.dispose();
    first.engine.dispose();
    later.scene.dispose();
    later.engine.dispose();
  });

  it("smoothly changes to the prepared phase-transition color", () => {
    const { engine, scene, controller, material } = createFixture();
    const initialBlue = material.diffuseColor.b;
    controller.setPhaseTransitionActive(true);

    controller.fixedUpdate(1 / 60);
    expect(controller.phaseTransitionBlend).toBeGreaterThan(0);
    expect(controller.phaseTransitionBlend).toBeLessThan(1);

    updateFor(controller, 2);
    expect(controller.phaseTransitionBlend).toBeCloseTo(1, 4);
    expect(material.diffuseColor.b).toBeGreaterThan(initialBlue);
    expect(material.diffuseColor.r).toBeCloseTo(
      gameConfig.ballVisual.phaseTransitionColor.r,
      3,
    );

    scene.dispose();
    engine.dispose();
  });

  it("restores its base appearance on disposal", () => {
    const { engine, scene, ball, motion, controller, material } = createFixture();
    motion.fallSpeed = 100;
    updateFor(controller, 1);

    controller.dispose();

    expect(ball.scaling.asArray()).toEqual([1, 1, 1]);
    expect(material.diffuseColor.r).toBe(gameConfig.ballVisual.baseColor.r);
    expect(ball.outlineWidth).toBe(gameConfig.ballVisual.baseOutlineWidth);

    scene.dispose();
    engine.dispose();
  });
});
