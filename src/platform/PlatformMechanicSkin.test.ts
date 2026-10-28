import { expect,it } from "vitest";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { Scene } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { VertexBuffer } from "@babylonjs/core/Buffers/buffer";
import { PlatformMechanicSkin } from "./PlatformMechanicSkin";
import type { PlatformMechanic } from "./PlatformMechanic";

it("uses three distinct silhouettes, a rotating turbine, preserved contact cues and pooled geometry",()=>{
  const engine=new NullEngine(),scene=new Scene(engine),parent=new Mesh("test",scene);
  parent.scaling.x=.4;
  const skin=new PlatformMechanicSkin(parent,.6,1,scene),vertices:number[][]=[];
  const resources=[scene.meshes.length,scene.materials.length];
  for(const kind of ["moving","wind-right","turret"] as PlatformMechanic[]) {
    skin.render(kind,3,"breakable",0,false);
    vertices.push(Array.from(skin.body.getVerticesData(VertexBuffer.PositionKind)??[]));
    const colors=skin.body.getVerticesData(VertexBuffer.ColorKind);
    expect(colors?.includes(.73)).toBe(true);
    expect(skin.body.scaling.x*parent.scaling.x).toBe(1);
    if(kind==="wind-right"){skin.render(kind,3,"breakable",1,false);expect(skin.part.rotation.z).toBe(8);}
    if(kind==="turret"){skin.aim(3,5);skin.render(kind,3,"danger",1,false);expect(skin.part.rotation.z).toBeLessThan(0);}
  }
  expect(vertices[0]).not.toEqual(vertices[1]);expect(vertices[1]).not.toEqual(vertices[2]);
  for(let i=0;i<100;i++)skin.render("wind-right",3,"breakable",i*.1,true);
  expect(skin.part.rotation.z).toBe(0);expect([scene.meshes.length,scene.materials.length]).toEqual(resources);
  skin.renderBreak(.5);expect(skin.body.visibility).toBe(.5);
  skin.reset();expect(skin.body.isEnabled()).toBe(false);
  scene.dispose();engine.dispose();
});
