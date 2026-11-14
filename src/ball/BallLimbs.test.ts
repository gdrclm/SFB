import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { Scene } from "@babylonjs/core/scene";
import { expect, it } from "vitest";
import { gameConfig } from "../config/gameConfig";
import { createBallMesh } from "./createBallMesh";
import { getBallLimbs } from "./BallLimbs";

it("tucks all four limbs on contact, releases them, and keeps them tucked after death", () => {
  const engine = new NullEngine(), scene = new Scene(engine), ball = createBallMesh(scene, gameConfig);
  const limbs = getBallLimbs(ball);
  if (!limbs) throw new Error("Expected limbs");
  const parts = scene.meshes.filter(mesh => /^Ball(Hand|Foot)/.test(mesh.name));
  expect(parts).toHaveLength(4);
  expect(parts.every(mesh => mesh.parent === ball && mesh.material?.name === "BallBlueDetails")).toBe(true);
  limbs.tuck();
  expect(parts.every(mesh => mesh.position.y < -.4 && Math.abs(mesh.position.x) < .15)).toBe(true);
  for (let i = 0; i < 90; i++) limbs.update(1 / 60, 20);
  expect(scene.getMeshByName("BallHandLeft")?.position.x).toBeLessThan(-.4);
  limbs.tuck(true);
  for (let i = 0; i < 180; i++) limbs.update(1 / 60, 160);
  expect(parts.every(mesh => mesh.position.y < -.4 && Math.abs(mesh.position.x) < .15)).toBe(true);
  scene.dispose(); engine.dispose();
});

it("increases limb movement frequency with speed using the same four meshes", () => {
  const count = (speed: number): number => {
    const engine = new NullEngine(), scene = new Scene(engine), ball = createBallMesh(scene, gameConfig);
    const limbs = getBallLimbs(ball), hand = scene.getMeshByName("BallHandLeft");
    if (!limbs || !hand) throw new Error("Expected limbs");
    const resources = [scene.meshes.length, scene.materials.length];
    let previous = hand.position.y, previousDelta = 0, crossings = 0;
    for (let i = 0; i < 240; i++) {
      limbs.update(1 / 60, speed);
      const current = hand.position.y, delta=current-previous;
      if (previousDelta * delta < 0) crossings++;
      previous = current;previousDelta=delta;
    }
    expect([scene.meshes.length, scene.materials.length]).toEqual(resources);
    scene.dispose(); engine.dispose(); return crossings;
  };
  expect(count(160)).toBeGreaterThan(count(10) * 3);
});

it("changes the silhouette from relaxed arms to paddling, a dive and a high-speed brace",()=>{
  const engine=new NullEngine(),scene=new Scene(engine),ball=createBallMesh(scene,gameConfig);
  const limbs=getBallLimbs(ball),hand=scene.getMeshByName("BallHandLeft");
  if(!limbs||!hand)throw new Error("Expected avatar limbs");
  const poses=[10,30,60,120].map(speed=>{limbs.update(0,speed);return {y:hand.position.y,x:hand.position.x,mode:(hand.metadata as {activity:string}).activity};});
  expect(poses.map(p=>p.mode)).toEqual(["drift","paddle","dive","surge"]);
  expect(poses[2]?.y).toBeGreaterThan(poses[0]?.y??0);
  expect(poses[2]?.x).not.toBe(poses[3]?.x);
  scene.dispose();engine.dispose();
});
