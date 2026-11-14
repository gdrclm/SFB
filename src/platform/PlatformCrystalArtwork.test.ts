import { expect, it } from "vitest";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { HavokPlugin } from "@babylonjs/core/Physics";
import HavokPhysics from "@babylonjs/havok";
import { readFile } from "node:fs/promises";
import { gameConfig } from "../config/gameConfig";
import { PlatformController } from "./PlatformController";
import { setPlatformCrystalBlend } from "./PlatformCrystalSkin";
import { HavokPlatformSweep } from "../collision/HavokPlatformSweep";

it("shows crystal artwork on ordinary, healing, slow and heavy platforms with their actual colliders unchanged",async()=>{
 const engine=new NullEngine(),scene=new Scene(engine);
 const wasm=await readFile(new URL("../../node_modules/@babylonjs/havok/lib/esm/HavokPhysics.wasm",import.meta.url));
 const plugin=new HavokPlugin(true,await HavokPhysics({wasmBinary:Uint8Array.from(wasm).buffer}));scene.enablePhysics(Vector3.Zero(),plugin);
 const template=gameConfig.platforms[0];if(!template)throw Error("Missing template");
 const p=new PlatformController(scene,gameConfig,template,false),position=new Vector3(0,0,0);
 const sweep=new HavokPlatformSweep(scene,plugin,.5,[p]);
 try{
  setPlatformCrystalBlend(scene,1);
  for(const [kind,row] of [["standard",0],["vitality",3],["time-slow",4],["super-heavy",0]] as const){
   p.reactivate(position,{strength:10,strengthLevel:"medium",widthScale:.4,kind});p.setApproachFeedback(20,1);
   const old=p.mesh.getChildMeshes().find(m=>(m.metadata as {spriteAtlas?:string}|null)?.spriteAtlas==="neon-rocks");
   const painted=scene.getMeshByName(`${p.id}-surface`);
   expect(old?.isVisible).toBe(false);expect(painted?.isEnabled()).toBe(true);
   expect(painted?.metadata).toMatchObject({surface:{kind:kind==="super-heavy"?11:7,materialRow:row,opacity:1}});
   expect(p.kind).toBe(kind);expect(p.surface).toBeUndefined();expect(p.strength).toBe(10);expect(p.width).toBe(3);
   expect(sweep.cast({x:0,y:3,z:0},{x:0,y:-3,z:0})?.id).toBe(p.id);
   p.beginBreak();p.prepareMaterialBreak(10,.3);p.playImpact(1,.3);p.renderBreak(.3);
   expect(p.usesPaintedBreak).toBe(true);expect(p.breakEffectSeconds).toBe(.85);
   expect(scene.getMeshByName(`${p.id}-surface-fragments`)?.isEnabled()).toBe(true);
   expect(painted?.isEnabled()).toBe(false);p.finishBreak();
  }
  setPlatformCrystalBlend(scene,.4);p.reactivate(position,{strength:10,strengthLevel:"medium",widthScale:.4});p.setApproachFeedback(null,2);
  expect(scene.getMeshByName(`${p.id}-surface`)?.metadata).toMatchObject({surface:{opacity:.4}});
  const old=p.mesh.getChildMeshes().find(m=>(m.metadata as {spriteAtlas?:string}|null)?.spriteAtlas==="neon-rocks");
  expect(old?.isVisible).toBe(true);expect(old?.visibility).toBe(.6);
  setPlatformCrystalBlend(scene,0);p.setApproachFeedback(null,3);
  expect(scene.getMeshByName(`${p.id}-surface`)?.isEnabled()).toBe(false);expect(old?.isVisible).toBe(true);
  p.deactivate();p.reactivate(position,{strength:10,strengthLevel:"medium",surface:"crystal"});
  expect(scene.getMeshByName(`${p.id}-surface`)?.isEnabled()).toBe(true);expect(old?.isVisible).toBe(false);
 }finally{p.dispose();scene.dispose();engine.dispose();}
});
