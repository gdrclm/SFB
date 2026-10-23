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

it("has solid wings and articulated depth motion with delayed tips, banking and no new meshes", () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  const camera = new FreeCamera("camera", new Vector3(0, 0, -10), scene); scene.activeCamera = camera;
  const birds = new BackdropBirds(scene); birds.update(0, 1);
  const wing = scene.getMeshByName("BackdropBirdWing-0--1");
  const tip = scene.getMeshByName("BackdropBirdTip-0--1");
  const shoulder = scene.getTransformNodeByName("BackdropBirdShoulder-0--1");
  const bird = scene.getTransformNodeByName("BackdropBird-0");
  if (!wing || !tip || !shoulder || !bird) throw new Error("Expected articulated bird");
  const vertices = wing.getVerticesData("position") ?? [];
  const ys = vertices.filter((_, i) => i % 3 === 1), zs = vertices.filter((_, i) => i % 3 === 2);
  expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(.05);
  expect(Math.max(...zs) - Math.min(...zs)).toBeGreaterThan(.3);
  const resources = [scene.meshes.length, scene.materials.length, scene.transformNodes.length];
  const beats: number[] = [], tips: number[] = [], banks: number[] = [];
  for (let i = 0; i < 120; i++) {
    birds.update(1 / 60, 1); beats.push(shoulder.rotation.x); tips.push(tip.rotation.x); banks.push(bird.rotation.x);
  }
  expect(Math.max(...beats) - Math.min(...beats)).toBeGreaterThan(1.5);
  expect(Math.max(...tips) - Math.min(...tips)).toBeGreaterThan(.4);
  expect(Math.max(...banks) - Math.min(...banks)).toBeGreaterThan(.1);
  const frozen = [...shoulder.rotation.asArray(), ...tip.rotation.asArray(), ...bird.position.asArray()];
  birds.update(0, 1);
  expect([...shoulder.rotation.asArray(), ...tip.rotation.asArray(), ...bird.position.asArray()]).toEqual(frozen);
  expect([scene.meshes.length, scene.materials.length, scene.transformNodes.length]).toEqual(resources);
  birds.dispose(); scene.dispose(); engine.dispose();
});

it("keeps the reduced-motion pose steady while continuing horizontal flight", () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  const birds = new BackdropBirds(scene, true); birds.update(0, 1);
  const shoulder = scene.getTransformNodeByName("BackdropBirdShoulder-1-1");
  const bird = scene.getTransformNodeByName("BackdropBird-1");
  if (!shoulder || !bird) throw new Error("Expected bird");
  const pose = shoulder.rotation.asArray(), x = bird.position.x, y = bird.position.y;
  for (let i = 0; i < 60; i++) birds.update(1 / 60, 1);
  expect(shoulder.rotation.asArray()).toEqual(pose);
  expect(bird.position.x).toBeGreaterThan(x); expect(bird.position.y).toBe(y);
  birds.dispose(); scene.dispose(); engine.dispose();
});
