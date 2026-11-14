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

it("keeps six shared atlases, the same quad and the collider through idle, impact and all breakup frames",()=>{
 const engine=new NullEngine(),scene=new Scene(engine),parent=new Mesh("painted",scene);parent.scaling.x=.4;parent.position.set(2,-7,0);
 const skin=new SurfaceSkin(parent,scene),other=new SurfaceSkin(new Mesh("another",scene),scene);
 const state={hits:3,cells:255,charge:0,infection:0};
 skin.render("island",3,3,state,null,10,false);other.render("storm",4,2,state,null,10,false);
 expect(skin.mesh.material).toBe(other.mesh.material);expect(surfaceArtTextures(scene)).toHaveLength(6);
 const textures=surfaceArtTextures(scene),buffer=skin.mesh.getVertexBuffer(VertexBuffer.PositionKind),count=[scene.meshes.length,scene.textures.length,scene.materials.length];
 skin.impact(10,1.5);skin.render("island",3,3,state,null,10.07,false);
 expect(skin.mesh.position.y+.7).toBeCloseTo(platformImpactMotion(.07,1.5).y);
 for(let i=0;i<=60;i++)skin.render("island",3,3,state,null,10+i/60,false,i/60);
 expect(surfaceArtTextures(scene)).toBe(textures);expect(skin.mesh.getVertexBuffer(VertexBuffer.PositionKind)).toBe(buffer);
 expect([scene.meshes.length,scene.textures.length,scene.materials.length]).toEqual(count);
 expect(parent.position.asArray()).toEqual([2,-7,0]);expect(parent.scaling.x).toBe(.4);
 scene.dispose();engine.dispose();
});

it("smoothly blends breakup keyframes and resets pops and removed cells on reuse, including reduced motion",()=>{
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
