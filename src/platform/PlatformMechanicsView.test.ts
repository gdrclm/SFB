import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { Scene } from "@babylonjs/core/scene";
import { expect,it } from "vitest";
import { PlatformMechanics } from "./PlatformMechanics";
import { PlatformMechanicsView } from "./PlatformMechanicsView";
import type { PlatformMechanic } from "./PlatformMechanic";
it("reuses visible mechanic glyphs and projectile meshes and releases them with the run",()=>{
  const engine=new NullEngine(),scene=new Scene(engine);
  const ball={position:{x:0,y:12,z:0},previousPosition:{x:0,y:12,z:0},fallSpeed:30};
  const platform={isActive:true,activationId:1,mechanic:"moving" as PlatformMechanic,width:2,mesh:{position:{x:0,y:0,z:0}}};
  const model=new PlatformMechanics(ball,()=>[platform],()=>({left:-8,right:8,bottom:-2,top:20}),1/3,.5,()=>{},()=>{});
  const view=new PlatformMechanicsView(scene,model),count=scene.meshes.length;
  model.fixedUpdate(.1);view.fixedUpdate();
  expect(scene.getMeshByName("PlatformMechanicArrow-0")?.isEnabled()).toBe(true);
  for(let i=0;i<120;i++) {
    platform.mesh.position.x=Math.sin(i*.1);
    platform.mechanic=i%2?"turret":"wind-right";platform.activationId++;
    model.fixedUpdate(1/60);view.fixedUpdate();
    expect(scene.meshes.length).toBe(count);
  }
  platform.isActive=false;model.fixedUpdate(.1);view.fixedUpdate();
  expect(scene.getMeshByName("PlatformMechanicArrow-0")?.isEnabled()).toBe(false);
  view.dispose();expect(scene.meshes).toHaveLength(0);
  scene.dispose();engine.dispose();
});
