import { expect, it } from "vitest";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { Scene } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { VertexBuffer } from "@babylonjs/core/Buffers/buffer";
import { SurfaceSkin, surfaceArtTextures } from "./SurfaceSkin";
import { SURFACES, customSurfaceArt } from "./PlatformSurfaces";
import { SURFACE_ART, SURFACE_ATLAS_SIZE, surfaceArtLayout, surfaceUVRect } from "./SurfaceArt";
import { platformImpactMotion } from "./PlatformImpactMotion";
import { surfacePreview } from "./SurfaceGuide";

it("gives every new type an illustrated atlas region, a collision anchor and a matching guide preview",()=>{
 for(const surface of SURFACES){
  if(!customSurfaceArt(surface))continue;
  const art=SURFACE_ART[surface];if(!art)throw Error(`Missing artwork for ${surface}`);
  const [x,y,w,h]=art.rect;
  expect(x).toBeGreaterThanOrEqual(0);expect(y).toBeGreaterThanOrEqual(0);
  expect(x+w).toBeLessThanOrEqual(SURFACE_ATLAS_SIZE);expect(y+h).toBeLessThanOrEqual(SURFACE_ATLAS_SIZE);
  expect(art.rim).toBeGreaterThanOrEqual(y);expect(art.rim).toBeLessThanOrEqual(y+h);
  for(const width of [.75,3,5.4]){
   const [,height,center]=surfaceArtLayout(art,width);
   expect(center+(.5-(art.rim-y)/h)*height).toBeCloseTo(.15,10);
  }
  expect(surfacePreview(surface)).toContain('<image href=');
  const uv=surfaceUVRect(art.rect);expect(uv.every(n=>n>=0&&n<=1)).toBe(true);
 }
});

it("keeps shared atlases and pooled buffers while real fragments move with a frozen painted pose",()=>{
 const engine=new NullEngine(),scene=new Scene(engine),parent=new Mesh("painted",scene);parent.scaling.x=.4;parent.position.set(2,-7,0);
 const skin=new SurfaceSkin(parent,scene),other=new SurfaceSkin(new Mesh("another",scene),scene);
 const state={hits:3,cells:255,charge:0,infection:0};
 skin.render("island",3,3,state,null,10,false);other.render("storm",4,2,state,null,10,false);
 expect(skin.mesh.material).toBe(other.mesh.material);expect(surfaceArtTextures(scene)).toHaveLength(6);
 const textures=surfaceArtTextures(scene),buffer=skin.mesh.getVertexBuffer(VertexBuffer.PositionKind);
 skin.impact(10,1.5);skin.render("island",3,3,state,null,10.07,false);
 expect(skin.mesh.position.y+.7).toBeCloseTo(platformImpactMotion(.07,1.5).y);
 skin.prepareBreak(10,.4);skin.render("island",3,3,state,null,10.07,false,0);
 const fragments=skin.fractureMesh;if(!fragments)throw Error("Missing physical fragments");
 const fragmentBuffer=fragments.getVertexBuffer(VertexBuffer.PositionKind),uvBuffer=fragments.getVertexBuffer(VertexBuffer.UVKind);
 const positions=Array.from(fragments.getVerticesData(VertexBuffer.PositionKind)??[]),uvs=Array.from(fragments.getVerticesData(VertexBuffer.UVKind)??[]);
 const count=[scene.meshes.length,scene.textures.length,scene.materials.length];
 const pose=(skin.mesh.metadata as {surface:{idleFrames:readonly number[]}}).surface.idleFrames;
 skin.render("island",3,3,state,null,10.4,false,.35);
 expect(skin.mesh.isEnabled()).toBe(false);expect(fragments.isEnabled()).toBe(true);
 expect(Array.from(fragments.getVerticesData(VertexBuffer.PositionKind)??[])).not.toEqual(positions);
 expect(Array.from(fragments.getVerticesData(VertexBuffer.UVKind)??[])).toEqual(uvs);
 expect((skin.mesh.metadata as {surface:{idleFrames:readonly number[]}}).surface.idleFrames).toBe(pose);
 for(let hit=0;hit<5;hit++){
  skin.reset();skin.render("island",3,3,state,null,11+hit,false);
  for(let i=0;i<=60;i++)skin.render("island",3,3,state,null,11+hit+i/60,false,i/60);
 }
 expect(skin.fractureMesh).toBe(fragments);expect(fragments.isEnabled()).toBe(false);
 expect(fragments.getVertexBuffer(VertexBuffer.PositionKind)).toBe(fragmentBuffer);expect(fragments.getVertexBuffer(VertexBuffer.UVKind)).toBe(uvBuffer);
 expect(surfaceArtTextures(scene)).toBe(textures);expect(skin.mesh.getVertexBuffer(VertexBuffer.PositionKind)).toBe(buffer);
 expect([scene.meshes.length,scene.textures.length,scene.materials.length]).toEqual(count);
 expect(parent.position.asArray()).toEqual([2,-7,0]);expect(parent.scaling.x).toBe(.4);
 scene.dispose();engine.dispose();
});

it("resets balloon pops and removed cells on reuse, including reduced motion",()=>{
 const engine=new NullEngine(),scene=new Scene(engine),skin=new SurfaceSkin(new Mesh("states",scene),scene);
 const state={hits:3,cells:255,charge:0,infection:0};
 skin.render("balloons",4,0,state,null,2,false);state.hits=2;skin.render("balloons",4,0,state,null,3,true);
 const paint=(skin.mesh.metadata as {surface:{previousHits:number;popAt:number;previousCells:number;cellsAt:number;frames:number[];time:number}}).surface;
 expect(paint.previousHits).toBe(3);expect(paint.popAt).toBe(3);skin.render("balloons",4,0,state,null,4,true);
 expect(paint.time-paint.popAt).toBe(1);
 skin.reset();skin.render("honeycomb",4,0,state,null,5,false);state.cells=131;skin.render("honeycomb",4,0,state,null,6,false);
 expect(paint.previousCells).toBe(255);expect(paint.cellsAt).toBe(6);
 skin.render("honeycomb",4,0,state,null,6.2,false,.5);expect(paint.frames).toEqual([3,4,0]);
 skin.render("honeycomb",4,0,state,null,6.3,true,.5);expect(paint.frames).toEqual([2,2,0]);
 skin.reset();state.hits=3;state.cells=255;skin.render("balloons",4,0,state,null,7,false);
 expect(paint.previousHits).toBe(3);expect(paint.popAt).toBe(-Infinity);expect(paint.previousCells).toBe(255);
 scene.dispose();engine.dispose();
});

it("eases crystal state colours and freezes the actual contact colour during fracture",()=>{
 const engine=new NullEngine(),scene=new Scene(engine),skin=new SurfaceSkin(new Mesh("tint",scene),scene),state={hits:1,cells:255,charge:0,infection:0};
 skin.material(0);skin.render("crystal",3,0,state,null,0,false);
 const paint=(skin.mesh.metadata as {surface:{color:Float32Array}}).surface,blue=paint.color.slice();
 skin.material(2);skin.render("crystal",3,0,state,"danger",.09,false);const middle=paint.color.slice();
 expect(middle[0]).toBeGreaterThan(blue[0]??0);expect(middle[0]).toBeLessThan(1);expect(middle[2]).toBeGreaterThan(.23);
 skin.render("crystal",3,0,state,"danger",.2,false);expect(paint.color[0]).toBeCloseTo(1);
 const contact=paint.color.slice();skin.render("crystal",3,0,state,"danger",.3,false,.5);expect(paint.color).toEqual(contact);
 scene.dispose();engine.dispose();
});
