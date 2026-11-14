import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { Scene } from "@babylonjs/core/scene";
import { afterEach, expect, it, vi } from "vitest";
import { DepthBackdrop } from "./DepthBackdrop";
const readiness=vi.hoisted(()=>({lava:true}));

vi.mock("./createIllustratedBackdrop", () => ({ preloadCrystalBackdrop: vi.fn() }));
vi.mock("./createPhaseOneBackdrop", async () => {
  const { MeshBuilder } = await import("@babylonjs/core/Meshes/meshBuilder");
  const { StandardMaterial } = await import("@babylonjs/core/Materials/standardMaterial");
  return { createPhaseOneBackdrop: (scene: Scene, rig: TransformNode, _appearance: unknown, location = "sky") => {
    const mesh = MeshBuilder.CreatePlane(location, { width: 28, height: 42 }, scene);
    mesh.parent = rig; mesh.material = new StandardMaterial(location, scene);
    mesh.metadata={scenery:{isReady:()=>location!=="lava"||readiness.lava,update:()=>{}}};
    return mesh;
  } };
});
afterEach(() => { vi.unstubAllGlobals();readiness.lava=true; });
function setup(reduced: boolean, startDepth = 0) {
  vi.stubGlobal("matchMedia", () => ({ matches: reduced }));
  const engine = new NullEngine(); const scene = new Scene(engine);
  const rig = new TransformNode("rig", scene);
  const camera = new FreeCamera("camera", new Vector3(0, 0, -20), scene);
  camera.orthoTop = 21; camera.orthoBottom = -21;
  camera.orthoLeft = -14; camera.orthoRight = 14;
  scene.activeCamera = camera;
  const backdrop = new DepthBackdrop(scene, rig, {}, startDepth);
  const root = (name: string): Mesh => {
    const mesh = scene.getMeshByName(name);
    if (mesh === null) throw new Error("Missing backdrop");
    return mesh as Mesh;
  };
  return { scene, camera, backdrop, root, dispose: () => { backdrop.dispose(); scene.dispose(); engine.dispose(); } };
}
it.each([false, true])("slides both scenes over two seconds even with reduced motion = %s", reduced => {
  const world = setup(reduced);
  try {
    world.backdrop.update(500, 0);
    expect(world.root("sky").position.y).toBe(0);
    expect(world.root("crystal").position.y).toBe(-42);
    for (let i = 0; i < 60; i++) world.backdrop.update(500, 1 / 60);
    expect(world.root("sky").position.y).toBeCloseTo(21);
    expect(world.root("crystal").position.y).toBeCloseTo(-21);
    expect(world.backdrop.crystalBlend).toBeCloseTo(.5);
    world.backdrop.update(500, 0); // Pausing cannot finish the slide.
    expect(world.backdrop.crystalBlend).toBeCloseTo(.5);
    for (let i = 0; i < 61; i++) world.backdrop.update(500, 1 / 60);
    expect(world.scene.getMeshByName("sky")).toBe(null);
    expect(world.root("crystal").position.y).toBe(0);
    expect(world.backdrop.crystalBlend).toBe(1);
  } finally { world.dispose(); }
});
it("does not turn a delayed frame into an instant switch and keeps pages touching after a resize", () => {
  const world = setup(false);
  try {
    world.backdrop.update(500, 5);
    expect(world.scene.getMeshByName("sky")).not.toBe(null);
    expect(world.backdrop.crystalBlend).toBeLessThan(.1);
    world.camera.orthoTop = 40; world.camera.orthoBottom = -40;
    world.backdrop.update(500, 0);
    expect(world.root("sky").position.y - world.root("crystal").position.y).toBeCloseTo(80);
  } finally { world.dispose(); }
});

it.each([[500, "crystal"], [3000, "lava"], [12000, "abyss"]] as const)("opens the correct backdrop immediately at %s metres", (depth, name) => {
  const world = setup(false, depth);
  try {
    expect(world.scene.getMeshByName("sky")).toBeNull();
    expect(world.root(name).position.y).toBe(0);
    world.backdrop.update(depth, 1 / 60);
    expect(world.scene.meshes).toHaveLength(1);
    expect(world.backdrop.crystalBlend).toBe(name === "crystal" ? 1 : 0);
    expect(world.backdrop.lavaBlend).toBe(name==="lava"?1:0);
  } finally { world.dispose(); }
});
it("fades crystal into warm ruins on the same ready page transition and freezes that lighting on pause",()=>{
 const world=setup(false,2999);
 try{
  world.backdrop.update(3000,0);expect(world.backdrop.crystalBlend).toBe(1);expect(world.backdrop.lavaBlend).toBe(0);
  for(let i=0;i<60;i++)world.backdrop.update(3000,1/60);
  expect(world.backdrop.lavaBlend).toBeCloseTo(.5);expect(world.backdrop.crystalBlend+world.backdrop.lavaBlend).toBeCloseTo(1);
  world.backdrop.update(3000,0);expect(world.backdrop.lavaBlend).toBeCloseTo(.5);
  for(let i=0;i<61;i++)world.backdrop.update(3000,1/60);expect(world.backdrop.lavaBlend).toBe(1);
  for(let i=0;i<121;i++)world.backdrop.update(12000,1/60);expect(world.backdrop.lavaBlend).toBe(0);
 }finally{world.dispose();}
});
it("waits for late ruins artwork before sliding the page or applying its warm lighting",()=>{
 readiness.lava=false;
 const world=setup(false,2999);
 try{
  for(let i=0;i<180;i++)world.backdrop.update(3000,1/60);
  expect(world.root("lava").isEnabled()).toBe(false);
  expect(world.backdrop.crystalBlend).toBe(1);expect(world.backdrop.lavaBlend).toBe(0);
  readiness.lava=true;
  for(let i=0;i<60;i++)world.backdrop.update(3000,1/60);
  expect(world.root("lava").isEnabled()).toBe(true);
  expect(world.backdrop.crystalBlend).toBeCloseTo(.5);expect(world.backdrop.lavaBlend).toBeCloseTo(.5);
  world.backdrop.update(3000,0);expect(world.backdrop.lavaBlend).toBeCloseTo(.5);
  for(let i=0;i<61;i++)world.backdrop.update(3000,1/60);
  expect(world.backdrop.lavaBlend).toBe(1);expect(world.backdrop.crystalBlend).toBe(0);
 }finally{world.dispose();}
});
