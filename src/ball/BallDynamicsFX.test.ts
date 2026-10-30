import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
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

it("keeps the attached comet visible at normal speed and reduced motion, but suppresses it during SLOW and bounce", () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  const ball = MeshBuilder.CreateSphere("ball", {}, scene), fx = new BallDynamicsFX(ball, 1);
  const motion = { speed: 10, look: 0, boost: 0, anticipating: false, slow: false, danger: false };
  fx.update(1 / 60, motion);
  expect(scene.getMeshByName("BallFXComet")?.visibility).toBe(1);
  fx.update(1 / 60, { ...motion, speed: 0 });
  expect(scene.getMeshByName("BallFXComet")?.visibility).toBe(0);
  fx.update(1 / 60, { ...motion, speed: 20 });
  expect(scene.getMeshByName("BallFXComet")?.visibility).toBe(1);
  fx.update(1 / 60, { ...motion, speed: 80, slow: true });
  expect(scene.getMeshByName("BallFXComet")?.visibility).toBe(0);
  fx.dispose();
  const reduced = new BallDynamicsFX(ball, 1, true);
  reduced.update(1 / 60, { ...motion, speed: 80, boost: 1 });
  expect(scene.getMeshByName("BallFXComet")?.visibility).toBe(1);
  expect(scene.getMeshByName("BallFXComet")?.scaling.y).toBeLessThanOrEqual(1.5);
  reduced.dispose(); scene.dispose(); engine.dispose();
});

it("places the first impact frame at contact even before the next simulation update", () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  const ball = MeshBuilder.CreateSphere("ball", {}, scene); ball.position.set(20, -500, 0);
  const fx = new BallDynamicsFX(ball, 1); fx.trigger("break"); fx.trigger("coin");
  expect(scene.getTransformNodeByName("BallFXRoot")?.position.y).toBeCloseTo(-500);
  expect(scene.getMeshByName("BallFXImpactFlash")?.visibility).toBeGreaterThan(0);
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

it("leaves platform fragments to the shared debris system while reward stars follow the falling character", () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  const ball = MeshBuilder.CreateSphere("ball", {}, scene), fx = new BallDynamicsFX(ball, 1);
  const motion = { speed: 10, look: 0, boost: 0, anticipating: false, slow: false, danger: false };
  fx.trigger("break"); fx.trigger("coin"); fx.update(.02, motion);
  ball.position.y = -10; fx.update(.02, motion);
  expect(scene.meshes.some(m=>m.name.startsWith("BallFXShard"))).toBe(false);
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

it("keeps the comet anchored to the ball as its tips lengthen with camera zoom", async () => {
  const { FreeCamera } = await import("@babylonjs/core/Cameras/freeCamera");
  const { Vector3 } = await import("@babylonjs/core/Maths/math.vector");
  const engine = new NullEngine(), scene = new Scene(engine);
  const camera = new FreeCamera("camera", new Vector3(0, 0, -10), scene);
  scene.activeCamera = camera;
  const ball = MeshBuilder.CreateSphere("ball", {}, scene), fx = new BallDynamicsFX(ball, .5);
  const motion = { speed: 20, look: 0, boost: 0, anticipating: false, slow: false, danger: false };
  camera.orthoTop = 10; camera.orthoBottom = -10;
  fx.update(.016, motion);
  const comet = scene.getMeshByName("BallFXComet");
  if (!comet) throw new Error("Expected attached comet");
  const initialLength = comet.scaling.y;
  camera.orthoTop = 120; camera.orthoBottom = -120;
  ball.position.set(3, -100, 0);
  fx.update(.016, { ...motion, speed: 160 });
  expect(comet.scaling.y).toBeGreaterThan(initialLength);
  expect(comet.position.y / comet.scaling.y).toBeCloseTo(2);
  expect(scene.getTransformNodeByName("BallFXRoot")?.position.asArray()).toEqual([3, -100, 0]);
  expect(comet.visibility).toBe(1);
  fx.dispose(); scene.dispose(); engine.dispose();
});


it("turns the comet with the character in both directions without inheriting squash", () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  const ball = MeshBuilder.CreateSphere("ball", {}, scene), fx = new BallDynamicsFX(ball, .5);
  ball.position.set(2, -10, 0);
  ball.scaling.set(.8, 1.6, .8);
  const comet = scene.getMeshByName("BallFXComet");
  const root = scene.getTransformNodeByName("BallFXRoot");
  if (!comet || !root) throw new Error("Expected character FX");
  for (const turn of [-.35, .35, 0]) {
    ball.rotation.set(0, -turn, turn);
    fx.update(1 / 60, { speed: 40, look: -turn, boost: 0, anticipating: false, slow: false, danger: false });
    const ballUp = Vector3.TransformNormal(Vector3.Up(), ball.computeWorldMatrix(true)).normalize();
    const jetUp = Vector3.TransformNormal(Vector3.Up(), comet.computeWorldMatrix(true)).normalize();
    expect(Vector3.Dot(ballUp, jetUp)).toBeCloseTo(1, 6);
    expect(root.rotation.asArray()).toEqual(ball.rotation.asArray());
    expect(root.position.asArray()).toEqual(ball.position.asArray());
    expect(root.scaling.asArray()).toEqual([1, 1, 1]);
  }
  fx.dispose(); scene.dispose(); engine.dispose();
});

it("leaves fading comet particles in world space with bounded resources", () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  const ball = MeshBuilder.CreateSphere("ball", {}, scene), fx = new BallDynamicsFX(ball, .5);
  const motion = { speed: 30, look: 0, boost: 0, anticipating: false, slow: false, danger: false };
  const resources = [scene.meshes.length, scene.materials.length];
  fx.update(.1, motion);
  const ember = scene.meshes.find(mesh => mesh.name.startsWith("BallFXEmber-") && mesh.visibility > 0);
  if (!ember) throw new Error("Expected residual particle");
  const y = ember.position.y;
  ball.position.y = -10;
  fx.update(.1, { ...motion, speed: 0 });
  expect(ember.position.y).toBeGreaterThan(y);
  expect(ember.position.y).toBeGreaterThan(-1);
  expect(ember.visibility).toBeGreaterThan(0);
  fx.update(1, { ...motion, speed: 0 });
  expect(scene.meshes.filter(mesh => mesh.name.startsWith("BallFXEmber-")).every(mesh => mesh.visibility === 0)).toBe(true);
  for (let i = 0; i < 180; i++) fx.update(1 / 60, motion);
  expect([scene.meshes.length, scene.materials.length]).toEqual(resources);
  fx.dispose(); expect(scene.meshes).toHaveLength(1);
  scene.dispose(); engine.dispose();
});
it("makes earned power denser and visibly distinct, then relaxes it without growing the effect pools",()=>{
 const density=(power:boolean):{count:number;arc:number}=>{
  const engine=new NullEngine(),scene=new Scene(engine),ball=MeshBuilder.CreateSphere("ball",{},scene),fx=new BallDynamicsFX(ball,.5);
  const resources=[scene.meshes.length,scene.materials.length];
  const motion={speed:80,look:0,boost:0,anticipating:false,slow:false,danger:false,power};
  fx.update(.1,motion);
  const result={count:scene.meshes.filter(m=>m.name.startsWith("BallFXEmber")&&m.visibility>0).length,arc:scene.getMeshByName("BallFXArc-0")?.visibility??0};
  fx.update(1,{...motion,power:false});expect(scene.getMeshByName("BallFXArc-0")?.visibility).toBeLessThan(.001);
  expect([scene.meshes.length,scene.materials.length]).toEqual(resources);fx.dispose();scene.dispose();engine.dispose();return result;
 };
 const normal=density(false),power=density(true);expect(power.count).toBeGreaterThan(normal.count);expect(power.arc).toBeGreaterThan(normal.arc);
});
