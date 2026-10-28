import { expect,it } from "vitest";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { Scene } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { VertexBuffer } from "@babylonjs/core/Buffers/buffer";
import { SkyPlatformSkin } from "./SkyPlatformSkin";
import { skyPlatformAppearance } from "./SkyPlatformAppearance";

it("mixes islands, clouds and bubbles only among ordinary sky platforms",()=>{
 const appearances=Array.from({length:40},(_,i)=>skyPlatformAppearance("sky","standard",undefined,i));
 expect(appearances.filter(x=>x===undefined)).toHaveLength(20);
 expect(appearances.filter(x=>x==="cloud")).toHaveLength(10);expect(appearances.filter(x=>x==="bubble")).toHaveLength(10);
 for(const location of ["crystal","lava","abyss"] as const)expect(skyPlatformAppearance(location,"standard",undefined,1)).toBeUndefined();
 for(const kind of ["super-heavy","vitality","time-slow"] as const)expect(skyPlatformAppearance("sky",kind,undefined,2)).toBeUndefined();
 expect(skyPlatformAppearance("sky","standard","moving",1)).toBeUndefined();
});
it("inflates a contacted cloud softly, fades on break and resets cleanly on pool reuse",()=>{
 const engine=new NullEngine(),scene=new Scene(engine),parent=new Mesh("cloud",scene);parent.scaling.x=.4;
 const skin=new SkyPlatformSkin(parent,.3,1,scene);
 skin.render("cloud",3,null,0,false);const width=skin.body.scaling.x,height=skin.body.scaling.y;
 skin.impact(0);skin.render("cloud",3,null,.2,false);
 expect(skin.body.scaling.x).toBeGreaterThan(width*1.15);expect(skin.body.scaling.y).toBeGreaterThan(height*1.3);
 expect(parent.scaling.x).toBe(.4);expect(skin.splash.isEnabled()).toBe(false);
 skin.render("cloud",3,null,1,false);expect(skin.body.scaling.x).toBeCloseTo(width);
 skin.renderBreak(.5);expect(skin.body.scaling.y).toBeGreaterThan(height);
 skin.reset();expect(skin.body.isEnabled()).toBe(false);
 skin.render("bubble",2,"boost",2,false);expect(skin.splash.isEnabled()).toBe(false);
 expect((skin.body.metadata as {sky:{opacity:number;style:number}}).sky).toMatchObject({opacity:1,style:1});
 scene.dispose();engine.dispose();
});
it("sprays a bounded set of droplets from the actual contact and reuses their buffers",()=>{
 const engine=new NullEngine(),scene=new Scene(engine),parent=new Mesh("bubble",scene);
 const skin=new SkyPlatformSkin(parent,.3,1,scene);skin.render("bubble",4,null,0,false);
 const count=scene.meshes.length,buffer=skin.splash.getVertexBuffer(VertexBuffer.PositionKind);
 skin.impact(0,1,1.2);skin.render("bubble",4,null,.2,false);
 expect(skin.splash.isEnabled()).toBe(true);
 const positions=Array.from(skin.splash.getVerticesData(VertexBuffer.PositionKind)??[]);
 const xs=positions.filter((_,i)=>i%3===0);expect(xs.reduce((sum,x)=>sum+x,0)/xs.length).toBeCloseTo(1.2);
 expect(Math.max(...positions.filter((_,i)=>i%3===1))).toBeGreaterThan(.6);
 for(let i=1;i<30;i++)skin.render("bubble",4,null,i/60,false);
 expect(scene.meshes.length).toBe(count);expect(skin.splash.getVertexBuffer(VertexBuffer.PositionKind)).toBe(buffer);
 skin.render("bubble",4,null,1,false);expect(skin.splash.isEnabled()).toBe(false);
 skin.reset();skin.render("cloud",3,null,2,true);expect(skin.splash.isEnabled()).toBe(false);
 scene.dispose();engine.dispose();
});
