import {expect,it,vi} from "vitest";
import {NullEngine} from "@babylonjs/core/Engines/nullEngine";
import {Scene} from "@babylonjs/core/scene";
import {Mesh} from "@babylonjs/core/Meshes/mesh";
import {VertexBuffer} from "@babylonjs/core/Buffers/buffer";
import {StandardMaterial} from "@babylonjs/core/Materials/standardMaterial";
import {RuinsScenery} from "./RuinsScenery";
import {RUINS_PROPS,RUINS_ATLAS_SIZE,RUINS_CLEAR_HALF_WIDTH} from "./RuinsSceneryLayout";
import {sceneryY} from "./BackdropMotion";

vi.mock("./SceneTextures",async()=>{
 const {Texture}=await import("@babylonjs/core/Materials/Textures/texture");
 return {sceneryTexture:(_url:string,scene:Scene)=>{const texture=new Texture(null,scene);vi.spyOn(texture,"isReady").mockReturnValue(true);return texture;}};
});
function setup(){
 const engine=new NullEngine(),scene=new Scene(engine),parent=new Mesh("RuinsBackdrop",scene),scenery=new RuinsScenery(scene,parent);
 return {engine,scene,parent,scenery,dispose:()=>{parent.dispose(false,true);scene.dispose();engine.dispose();}};
}
it("samples complete non-overlapping atlas silhouettes at their natural aspect ratio and keeps the central shaft clear",()=>{
 const f=setup();
 for(const prop of RUINS_PROPS){
  const [left,top,right,bottom]=prop.bounds,[w,h]=RUINS_ATLAS_SIZE;
  expect(left).toBeGreaterThanOrEqual(0);expect(top).toBeGreaterThanOrEqual(0);expect(right).toBeLessThanOrEqual(w);expect(bottom).toBeLessThanOrEqual(h);
  const mesh=f.scene.getMeshByName(`RuinsProp-${prop.name}-0`);
  if(!mesh)throw Error("Missing illustrated ruins silhouette");
  const positions=mesh.getVerticesData(VertexBuffer.PositionKind)??[];
  const width=Math.max(...positions.filter((_,i)=>i%3===0))-Math.min(...positions.filter((_,i)=>i%3===0));
  const height=Math.max(...positions.filter((_,i)=>i%3===1))-Math.min(...positions.filter((_,i)=>i%3===1));
  expect(width/height).toBeCloseTo((right-left)/(bottom-top));
  expect(Math.abs(prop.x)-width/2).toBeGreaterThan(RUINS_CLEAR_HALF_WIDTH);
  for(const other of RUINS_PROPS){if(prop===other)continue;const [ol,ot,or,ob]=other.bounds;expect(right<=ol||or<=left||bottom<=ot||ob<=top).toBe(true);}
 }
 f.dispose();
});
it("uses different depth rates, freezes glow and cages on pause and shares clipping with the sliding backdrop",()=>{
 const f=setup();f.scenery.update(0,0,-100,84,false,.08);
 const cage=f.scene.getMeshByName("RuinsProp-cage-0"),halo=f.scene.getMeshByName("RuinsTorchHalo-0-0");
 if(!cage||!halo)throw Error("Missing animated ruins");
 const rotation=cage.rotation.z,pulse=halo.visibility;
 f.scenery.update(0,0,-100,84,false,0);expect(cage.rotation.z).toBe(rotation);expect(halo.visibility).toBe(pulse);
 f.scenery.update(10,2,-100,84,false,.08);
 for(const prop of RUINS_PROPS)expect(f.scene.getMeshByName(`RuinsProp-${prop.name}-0`)?.position.y).toBeCloseTo(sceneryY(prop.anchor,10,prop.rate));
 for(const material of f.scene.materials){expect(material.clipPlane?.d).toBe(58);expect(material.clipPlane2?.d).toBe(-142);}
 f.scenery.update(10,2,-100,84,true,.08);expect(cage.rotation.z).toBe(0);expect(halo.visibility).toBe(.72);
 f.dispose();
});
it("keeps resources bounded and parent disposal releases all scene-owned meshes and materials",()=>{
 const f=setup(),baseline=[f.scene.meshes.length,f.scene.materials.length,f.scene.textures.length];
 expect(f.scene.meshes.length).toBe(31);expect(f.scene.lights.length).toBe(0);
 for(let i=0;i<240;i++)f.scenery.update(i*.2,Math.sin(i*.05)*4,-i,42,i%2===0,.016);
 expect([f.scene.meshes.length,f.scene.materials.length,f.scene.textures.length]).toEqual(baseline);
 f.parent.dispose(false,true);f.scenery.dispose();expect(f.scene.meshes.length).toBe(0);expect(f.scene.materials.length).toBe(0);
 f.scene.dispose();f.engine.dispose();
});
it("does not block the next page forever when its scenery atlas fails",()=>{
 const f=setup();const material=f.scene.getMaterialByName("RuinsWholeLedges");
 if(!(material instanceof StandardMaterial)||!material.diffuseTexture)throw Error("Missing ruins atlas");
 vi.spyOn(material.diffuseTexture,"isReady").mockReturnValue(false);expect(f.scenery.isReady()).toBe(false);
 Object.defineProperty(material.diffuseTexture,"loadingError",{value:true});expect(f.scenery.isReady()).toBe(true);f.dispose();
});
