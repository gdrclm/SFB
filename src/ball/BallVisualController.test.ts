import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { TrailMesh } from "@babylonjs/core/Meshes/trailMesh";
import { Scene } from "@babylonjs/core/scene";
import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { SuccessfulHitEffects } from "../effects/SuccessfulHitEffects";
import { UnsuccessfulHitEffects } from "../effects/UnsuccessfulHitEffects";
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
  it("compresses on the contact frame and keeps the bottom anchored to the surface", () => {
    const { engine, scene, ball, controller } = createFixture(60);
    controller.react("hurt");
    expect(ball.scaling.y).toBeLessThan(.6);
    expect(ball.scaling.x * ball.scaling.y * ball.scaling.z).toBeCloseTo(1, 8);
    const bottom = Vector3.TransformCoordinates(new Vector3(0, -gameConfig.ball.radius, 0), ball.computeWorldMatrix(true));
    expect(bottom.y).toBeCloseTo(ball.position.y - gameConfig.ball.radius, 6);
    updateFor(controller, .6);
    expect(ball.getPivotPoint().length()).toBe(0);
    controller.dispose(); scene.dispose(); engine.dispose();
  });

  it("continues stretching through later speed doublings and relaxes after slowing down", () => {
    const { engine, scene, ball, motion, controller } = createFixture();
    let height = 1;
    for (const speed of [20, 40, 80, 160, 320]) {
      motion.fallSpeed = speed; updateFor(controller, 1.5);
      expect(ball.scaling.y).toBeGreaterThan(height + .015);
      expect(ball.scaling.x * ball.scaling.y * ball.scaling.z).toBeCloseTo(1, 8);
      if (speed <= 40) expect(ball.scaling.y).toBeLessThan(1.13);
      height = ball.scaling.y;
    }
    expect(height).toBeGreaterThan(2.1);
    expect(height).toBeLessThan(2.3);
    motion.fallSpeed = gameConfig.ball.startFallSpeed; updateFor(controller, 2);
    expect(ball.scaling.y).toBeCloseTo(1, 3);
    controller.dispose(); scene.dispose(); engine.dispose();
  });

  it("compresses before the boost burst and preserves volume at every intermediate pose", () => {
    const { engine, scene, ball, controller } = createFixture();
    controller.playBoostReaction({ success: true, previousSpeed: 10, currentSpeed: 15, energyCost: 1 });
    let compressed = false, stretched = false;
    for (let step = 0; step < 40; step++) {
      controller.fixedUpdate(1 / 60);
      if (step < 6 && ball.scaling.y < .85) compressed = true;
      if (step >= 6 && ball.scaling.y > 1.05) stretched = true;
      expect(ball.scaling.y).toBeLessThan(1.35);
      expect(ball.scaling.x * ball.scaling.y * ball.scaling.z).toBeCloseTo(1, 10);
    }
    expect(compressed).toBe(true); expect(stretched).toBe(true);
    controller.dispose(); scene.dispose(); engine.dispose();
  });

  it("reacts to contact during BOOST while keeping the focused boost expression", () => {
    const contact = createFixture(), free = createFixture();
    const boost = { success: true, previousSpeed: 10, currentSpeed: 15, energyCost: 1 } as const;
    for (const fixture of [contact, free]) { fixture.controller.playBoostReaction(boost); updateFor(fixture.controller, .1); }
    contact.controller.react("break");
    for (const fixture of [contact, free]) updateFor(fixture.controller, .06);
    expect(contact.ball.scaling.y).toBeGreaterThan(free.ball.scaling.y);
    expect(contact.ball.scaling.x*contact.ball.scaling.y*contact.ball.scaling.z).toBeCloseTo(1,8);
    expect(contact.ball.metadata).toMatchObject({ expression: "boost" });
    for (const fixture of [contact, free]) { fixture.controller.dispose(); fixture.scene.dispose(); fixture.engine.dispose(); }
  });

  it("owns squash so legacy collision effects cannot overwrite the avatar pose", () => {
    const { engine, scene, ball, motion, controller } = createFixture();
    const camera = new FreeCamera("camera", new Vector3(0, 0, -10), scene);
    const success = new SuccessfulHitEffects(ball, camera, gameConfig);
    const failure = new UnsuccessfulHitEffects(ball, camera, gameConfig);
    const baseline = { meshes: scene.meshes.length, materials: scene.materials.length };
    controller.react("hurt"); updateFor(controller, .08);
    expect(ball.scaling.y).toBeLessThan(1);
    const pose = ball.scaling.asArray();
    success.playBallReaction(); success.fixedUpdate(.05);
    expect(ball.scaling.asArray()).toEqual(pose);
    failure.playErrorReaction({ mesh: ball }); failure.fixedUpdate(.05);
    expect(ball.scaling.asArray()).toEqual(pose);
    updateFor(controller, 1.5);
    expect(ball.scaling.y).toBeCloseTo(1, 5);
    for (let i = 0; i < 30; i++) { controller.react("coin"); controller.fixedUpdate(1 / 60); }
    expect({ meshes: scene.meshes.length, materials: scene.materials.length }).toEqual(baseline);
    expect(motion.fallSpeed).toBe(gameConfig.ball.startFallSpeed);
    success.dispose(); failure.dispose(); controller.dispose(); scene.dispose(); engine.dispose();
  });

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

  it("keeps the trajectory trail readable at starting speed without waiting for late stages", () => {
    const { engine, scene, controller } = createFixture();
    const trail = scene.getMeshByName("BallSpeedTrail");
    if (!(trail?.material instanceof StandardMaterial)) throw new Error("Expected trajectory trail");
    expect(trail.material.backFaceCulling).toBe(false);
    expect(trail.visibility * trail.material.alpha).toBeGreaterThan(.45);
    updateFor(controller, 1);
    expect(trail.material.backFaceCulling).toBe(false);
    expect(trail.visibility * trail.material.alpha).toBeGreaterThan(.45);
    expect(trail.material.emissiveColor.b).toBeGreaterThan(.8);
    controller.dispose(); scene.dispose(); engine.dispose();
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

  it("keeps strengthening the trail through successive speed doublings and softens it again on slowdown", () => {
    const { engine, scene, motion, controller } = createFixture();
    const trail = scene.getMeshByName("BallSpeedTrail");
    if (!(trail instanceof TrailMesh) || !(trail.material instanceof StandardMaterial)) throw new Error("Expected speed trail");
    let visibility = trail.visibility, diameter = trail.diameter, alpha = trail.material.alpha;
    for (const speed of [20, 40, 80, 160, 320]) {
      motion.fallSpeed = speed;
      updateFor(controller, 2);
      expect(trail.visibility).toBeGreaterThan(visibility);
      expect(trail.diameter).toBeGreaterThan(diameter);
      expect(trail.material.alpha).toBeGreaterThan(alpha);
      visibility = trail.visibility; diameter = trail.diameter; alpha = trail.material.alpha;
      expect(motion.fallSpeed).toBe(speed);
    }
    motion.fallSpeed = 10000;
    updateFor(controller, 2);
    expect(trail.visibility).toBeLessThanOrEqual(gameConfig.ballVisual.maximumTrailVisibility);
    expect(trail.diameter).toBeLessThanOrEqual(gameConfig.ball.radius * gameConfig.ballVisual.trailDiameterScale * 3.4);
    motion.fallSpeed = gameConfig.ball.startFallSpeed;
    updateFor(controller, 3);
    expect(trail.visibility).toBeCloseTo(gameConfig.ballVisual.baseTrailVisibility, 5);
    expect(trail.diameter).toBeCloseTo(gameConfig.ball.radius * gameConfig.ballVisual.trailDiameterScale, 5);
    scene.dispose(); engine.dispose();
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


it("blends crystal light with the location, preserves the face and reuses its halo", () => {
  const { engine, scene, ball, controller } = createFixture();
  const halo = scene.getMeshByName("BallCrystalHalo");
  const blue = scene.getMaterialByName("BallBlueDetails") as StandardMaterial;
  const face = scene.getMaterialByName("BallFaceDetails") as StandardMaterial;
  const originalFace = face.emissiveColor.clone();
  const baseOutline = ball.outlineColor.clone(), baseWidth = ball.outlineWidth;
  const meshes = scene.meshes.length, materials = scene.materials.length, textures = scene.textures.length;
  expect(halo?.isEnabled()).toBe(false);
  controller.setCrystalBlend(.5);
  expect(halo?.visibility).toBe(.5);
  expect(halo?.isEnabled()).toBe(true);
  const partial = ball.outlineColor.clone();
  controller.setCrystalBlend(1);
  expect(ball.outlineColor.g).toBeGreaterThan(partial.g);
  expect(ball.outlineWidth).toBeGreaterThan(baseWidth);
  expect(blue.emissiveColor.g).toBeCloseTo(.8);
  expect(face.emissiveColor.equals(originalFace)).toBe(true);
  controller.react("hurt"); controller.fixedUpdate(1 / 60);
  expect(halo?.parent).toBe(ball);
  expect(halo?.isEnabled()).toBe(true);
  for (let i = 0; i < 100; i++) controller.setCrystalBlend(i % 2);
  expect(scene.meshes.length).toBe(meshes);
  expect(scene.materials.length).toBe(materials);
  expect(scene.textures.length).toBe(textures);
  controller.setCrystalBlend(0);
  expect(halo?.isEnabled()).toBe(false);
  expect(ball.outlineColor.equals(baseOutline)).toBe(true);
  expect(blue.emissiveColor.g).toBeCloseTo(.18);
  controller.dispose();
  expect(scene.getMeshByName("BallCrystalHalo")).toBeNull();
  expect(scene.getMaterialByName("BallCrystalHaloMaterial")).toBeNull();
  scene.dispose(); engine.dispose();
});

it("spins in place before the tutorial launch and flies beyond the camera without allocating meshes", () => {
  const { engine, scene, ball, controller } = createFixture();
  const start = ball.position.clone(), count = scene.meshes.length;
  controller.renderTutorialFinish(1 / 60, .5, 20, false);
  expect(ball.position.y).toBe(start.y); expect(Math.abs(ball.rotation.z)).toBeGreaterThan(8);
  controller.renderTutorialFinish(1 / 60, 1.6, 20, false);
  expect(ball.position.y).toBeGreaterThan(start.y + 20);
  expect(ball.scaling.x * ball.scaling.y * ball.scaling.z).toBeCloseTo(1, 8);
  expect(scene.meshes.length).toBe(count);
  controller.dispose(); scene.dispose(); engine.dispose();
});
