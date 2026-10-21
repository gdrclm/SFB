import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Scene } from "@babylonjs/core/scene";
import { expect, it } from "vitest";
import { BallDynamicsFX } from "./BallDynamicsFX";

it("adds more, longer and thicker side wind as speed doubles", () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  const ball = MeshBuilder.CreateSphere("ball", {}, scene), fx = new BallDynamicsFX(ball, 1);
  let count = 0, length = 0, width = 0;
  for (const speed of [20, 40, 80, 160, 320]) {
    for (let i = 0; i < 60; i++) fx.update(1 / 60, { speed, look: 0, boost: 0, anticipating: false, slow: false, danger: false });
    const lines = scene.meshes.filter(m => m.name.startsWith("BallFXWind-") && Number(m.name.split("-").at(-1)) >= 3);
    const active = lines.filter(m => m.visibility > .05).length;
    expect(active).toBeGreaterThan(count);
    expect(lines[0]?.scaling.y).toBeGreaterThan(length);
    expect(lines[0]?.scaling.x).toBeGreaterThan(width);
    count = active; length = lines[0]?.scaling.y ?? 0; width = lines[0]?.scaling.x ?? 0;
  }
  fx.dispose(); scene.dispose(); engine.dispose();
});

it("places the first impact frame at contact even before the next simulation update", () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  const ball = MeshBuilder.CreateSphere("ball", {}, scene); ball.position.set(20, -500, 0);
  const fx = new BallDynamicsFX(ball, 1); fx.trigger("break"); fx.trigger("coin");
  expect(scene.getMeshByName("BallFXShard-0")?.position.y).toBeCloseTo(-500.8);
  expect(scene.getMeshByName("BallFXStar-0")?.position.y).toBeLessThan(-498);
  expect(scene.getMeshByName("BallFXStar-0")?.scaling.x).toBeLessThan(.2);
  fx.dispose(); scene.dispose(); engine.dispose();
});

it("keeps effects independent from squash and reuses bounded resources through rapid hits", () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  const ball = MeshBuilder.CreateSphere("ball", {}, scene), fx = new BallDynamicsFX(ball, 1);
  const baseline = { meshes: scene.meshes.length, materials: scene.materials.length };
  ball.scaling.set(1.5, .5, 1.5);
  const motion = { speed: 60, look: .8, boost: 1, anticipating: false, slow: false, danger: false };
  for (let i = 0; i < 30; i++) { fx.trigger(i % 2 ? "coin" : "break"); fx.update(1 / 60, motion); }
  expect({ meshes: scene.meshes.length, materials: scene.materials.length }).toEqual(baseline);
  expect(scene.getTransformNodeByName("BallFXRoot")?.scaling.asArray()).toEqual([1, 1, 1]);
  expect(scene.meshes.some(m => m.name.startsWith("BallFXWind") && m.visibility > 0)).toBe(true);
  expect(ball.scaling.asArray()).toEqual([1.5, .5, 1.5]);
  fx.dispose(); expect(scene.meshes).toHaveLength(1); expect(scene.materials.some(m => m.name.startsWith("BallFX"))).toBe(false);
  scene.dispose(); engine.dispose();
});

it("leaves break shards at contact while reward stars follow the falling character", () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  const ball = MeshBuilder.CreateSphere("ball", {}, scene), fx = new BallDynamicsFX(ball, 1);
  const motion = { speed: 10, look: 0, boost: 0, anticipating: false, slow: false, danger: false };
  fx.trigger("break"); fx.trigger("coin"); fx.update(.02, motion);
  ball.position.y = -10; fx.update(.02, motion);
  expect(scene.getMeshByName("BallFXShard-0")?.position.y).toBeGreaterThan(-3);
  expect(scene.getMeshByName("BallFXStar-0")?.position.y).toBeLessThan(-7);
  fx.update(1, motion);
  expect(scene.meshes.filter(m => /BallFX(Shard|Star)/.test(m.name)).every(m => m.visibility === 0)).toBe(true);
  fx.dispose(); scene.dispose(); engine.dispose();
});

it("keeps the slow orbit active while suppressing high-speed streaks", () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  const ball = MeshBuilder.CreateSphere("ball", {}, scene), fx = new BallDynamicsFX(ball, 1);
  fx.update(1, { speed: 100, look: 0, boost: 0, anticipating: false, slow: true, danger: true });
  expect(scene.getMeshByName("BallFXArc-0")?.visibility).toBeGreaterThan(.5);
  expect(scene.getMeshByName("BallFXWind-0")?.visibility).toBe(0);
  expect(scene.getMeshByName("BallFXOrbitDot-0")?.visibility).toBeGreaterThan(0);
  fx.dispose(); scene.dispose(); engine.dispose();
});
