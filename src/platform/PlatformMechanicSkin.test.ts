import { expect,it } from "vitest";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { Scene } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { VertexBuffer } from "@babylonjs/core/Buffers/buffer";
import { PlatformMechanicSkin } from "./PlatformMechanicSkin";
import type { PlatformMechanic } from "./PlatformMechanic";
import { surfaceAnimation } from "./SurfaceAnimation";
type Metadata={surface:{kind:number;angle:number;rect:readonly number[];idleFrames:readonly number[];frames:readonly number[];layout:readonly number[]}};
it("paints every machine variant with six poses while keeping rotors, aiming, colliders and pooled buffers independent",()=>{
 const engine=new NullEngine(),scene=new Scene(engine),parent=new Mesh("test",scene);parent.scaling.x=.4;parent.position.set(2,-7,0);
 const skin=new PlatformMechanicSkin(parent,.6,1,scene),count=[scene.meshes.length,scene.materials.length,scene.textures.length],buffer=skin.body.getVertexBuffer(VertexBuffer.PositionKind);
 const regions:string[]=[];
 for(const kind of ["moving","wind-right","wind-left","turret"] as PlatformMechanic[]){
  skin.render(kind,3,"breakable",0,false);regions.push(JSON.stringify((skin.body.metadata as Metadata).surface.rect));
  expect(surfaceAnimation(kind)?.idle).toHaveLength(6);expect(surfaceAnimation(kind)?.destroy).toHaveLength(6);
  if(kind.startsWith("wind")){skin.render(kind,3,"breakable",1,false);expect((skin.part.metadata as Metadata).surface.angle).toBe(kind==="wind-left"?-8:8);}
  if(kind==="turret"){skin.aim(5,4);skin.render(kind,3,"danger",1,false);expect((skin.part.metadata as Metadata).surface.angle).toBeLessThan(0);}
 }
 expect(new Set(regions).size).toBe(3);expect(skin.body.material).toBe(skin.part.material);
 for(let i=0;i<100;i++)skin.render("wind-right",3,"breakable",i*.1,true);
 expect((skin.part.metadata as Metadata).surface.angle).toBe(0);expect((skin.body.metadata as Metadata).surface.idleFrames).toEqual([0,0,0]);
 skin.renderBreak(.5);expect((skin.body.metadata as Metadata).surface.frames).toEqual([2,2,0]);expect(skin.part.isEnabled()).toBe(false);
 expect(skin.body.getVertexBuffer(VertexBuffer.PositionKind)).toBe(buffer);expect([scene.meshes.length,scene.materials.length,scene.textures.length]).toEqual(count);
 expect(parent.position.asArray()).toEqual([2,-7,0]);expect(parent.scaling.x).toBe(.4);
 skin.reset();expect(skin.body.isEnabled()).toBe(false);skin.render("turret",3,null,10,false);expect((skin.part.metadata as Metadata).surface.angle).toBe(0);
 scene.dispose();engine.dispose();
});
