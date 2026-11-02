import {expect,it} from "vitest";
import {NullEngine} from "@babylonjs/core/Engines/nullEngine";
import {Scene} from "@babylonjs/core/scene";
import {StandardMaterial} from "@babylonjs/core/Materials/standardMaterial";
import type {UniformBuffer} from "@babylonjs/core/Materials/uniformBuffer";
import type {SubMesh} from "@babylonjs/core/Meshes/subMesh";
import {PlatformCrystalSkin,setPlatformCrystalBlend,setPlatformLavaBlend,getPlatformLavaBlend,getPlatformLavaTint} from "./PlatformCrystalSkin";

it("keeps torch grading scene-local and fades state colors without losing their identity",()=>{
 const engine=new NullEngine(),scene=new Scene(engine),other=new Scene(engine),material=new StandardMaterial("stone",scene),skin=new PlatformCrystalSkin(material);
 const uniforms=new Map<string,number[]>(),buffer={updateFloat4:(name:string,...values:number[])=>{uniforms.set(name,values);}} as unknown as UniformBuffer;
 const sample={row:3,previousRow:0,rowBlend:1};
 const submesh={getMesh:()=>({metadata:sample})} as unknown as SubMesh;
 setPlatformCrystalBlend(scene,.4);setPlatformLavaBlend(scene,1);
 skin.hardBindForSubMesh(buffer,scene,engine,submesh);
 expect(uniforms.get("platformCrystalTint")?.[3]).toBe(.4);
 const healing=uniforms.get("platformLavaTint")??[];
 expect(healing[1]).toBeGreaterThan(healing[0]??0);expect(healing[1]).toBeGreaterThan(healing[2]??0);expect(healing[3]).toBe(1);
 sample.row=2;skin.hardBindForSubMesh(buffer,scene,engine,submesh);
 const danger=uniforms.get("platformLavaTint")??[];
 expect(danger[0]).toBeGreaterThan((danger[1]??0)*3);
 expect(getPlatformLavaBlend(other)).toBe(0);
 sample.row=1;sample.rowBlend=.5;skin.hardBindForSubMesh(buffer,scene,engine,submesh);
 const partial=uniforms.get("platformLavaTint")??[];
 expect(partial[1]).toBeGreaterThan(getPlatformLavaTint(0)[1]);expect(partial[1]).toBeLessThan(getPlatformLavaTint(1)[1]);
 setPlatformLavaBlend(scene,0);skin.hardBindForSubMesh(buffer,scene,engine,submesh);
 expect(uniforms.get("platformLavaTint")?.[3]).toBe(0);
 scene.dispose();other.dispose();engine.dispose();
});
it("allows machine materials to keep their original crystal palette while sharing the third-location torch grading",()=>{
 const engine=new NullEngine(),scene=new Scene(engine),material=new StandardMaterial("machine",scene),skin=new PlatformCrystalSkin(material,false);
 const uniforms=new Map<string,number[]>(),buffer={updateFloat4:(name:string,...values:number[])=>{uniforms.set(name,values);}} as unknown as UniformBuffer;
 const submesh={getMesh:()=>({metadata:{row:0}})} as unknown as SubMesh;
 setPlatformCrystalBlend(scene,1);setPlatformLavaBlend(scene,0);skin.hardBindForSubMesh(buffer,scene,engine,submesh);
 expect(uniforms.get("platformCrystalTint")?.[3]).toBe(0);expect(uniforms.get("platformLavaTint")?.[3]).toBe(0);
 setPlatformLavaBlend(scene,1);skin.hardBindForSubMesh(buffer,scene,engine,submesh);
 expect(uniforms.get("platformCrystalTint")?.[3]).toBe(0);expect(uniforms.get("platformLavaTint")?.[3]).toBe(1);
 scene.dispose();engine.dispose();
});
