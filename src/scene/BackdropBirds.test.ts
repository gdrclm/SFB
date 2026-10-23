import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Scene } from "@babylonjs/core/scene";
import { expect, it } from "vitest";
import { BackdropBirds } from "./BackdropBirds";

it("flies horizontally at fixed screen altitudes regardless of fall, pan and zoom", () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  const camera = new FreeCamera("camera", new Vector3(0, 0, -10), scene); scene.activeCamera = camera;
  camera.orthoTop = 20; camera.orthoBottom = -20; camera.orthoLeft = -10; camera.orthoRight = 10;
  const birds = new BackdropBirds(scene); birds.update(0, 1);
  const bird = scene.getTransformNodeByName("BackdropBird-1");
  if (!bird) throw new Error("Expected bird");
  for (const i of [0, 1, 2]) {
    const initial = scene.getTransformNodeByName(`BackdropBird-${String(i)}`);
    if (!initial) throw new Error("Expected initial visible flock");
    expect((initial.position.x + 10) / 20).toBeGreaterThan(.03);
    expect((initial.position.x + 10) / 20).toBeLessThan(.97);
    expect(initial.scaling.x / 20 * engine.getRenderWidth() * 1.28).toBeGreaterThan(30);
  }
  const initialX = bird.position.x;
  const altitude = (bird.position.y + 20) / 40;
  for (let i = 0; i < 60; i++) birds.update(1 / 60, 1);
  expect(bird.position.x).toBeGreaterThan(initialX);
  expect((bird.position.y + 20) / 40).toBeCloseTo(altitude);
  camera.position.set(12, -1000, -10); camera.orthoTop = 60; camera.orthoBottom = -60;
  birds.update(0, 1);
  expect((bird.position.y + 60) / 120).toBeCloseTo(altitude);
  const pausedX = bird.position.x; birds.update(0, 1); expect(bird.position.x).toBe(pausedX);
  birds.update(0, 0); expect(scene.getTransformNodeByName("BackdropBirds")?.isEnabled()).toBe(false);
  birds.dispose(); expect(scene.meshes).toHaveLength(0);
  expect(scene.getMaterialByName("BackdropBirdMaterial")).toBeNull();
  expect(scene.getMaterialByName("BackdropBirdBeakMaterial")).toBeNull();
  scene.dispose(); engine.dispose();
});
