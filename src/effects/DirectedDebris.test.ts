import {expect,it} from "vitest";
import {NullEngine} from "@babylonjs/core/Engines/nullEngine";
import {Scene} from "@babylonjs/core/scene";
import {DirectedDebris,DEBRIS_POOL_SIZE} from "./DirectedDebris";
it("sends the main mass downward, throws edges sideways and sends fine fragments after the falling ball",()=>{
 const engine=new NullEngine(),scene=new Scene(engine),fx=new DirectedDebris(scene);
 fx.emit(0,0,0,5,.2,80,0);
 const pieces=scene.meshes.filter(m=>m.name.startsWith("DirectedDebris")),start=pieces.map(m=>m.position.clone());
 fx.update(.1,{x:.2,y:-3},80);
 for(const [i,p] of pieces.entries())expect(p.position.y).toBeLessThan(start[i]?.y??0);
 const group=(m:typeof pieces[number])=>(m.metadata as {group:string}).group;
 const mass=pieces.filter(m=>group(m)==="mass"),fine=pieces.filter(m=>group(m)==="fine");
 expect(mass.length).toBeGreaterThan(pieces.length/2-1);
 const average=(ms:typeof pieces)=>ms.reduce((v,m)=>v+m.position.y,0)/ms.length;
 expect(average(fine)).toBeLessThan(average(mass));
 for(const p of pieces.filter(m=>group(m)==="edge"))expect(Math.abs(p.position.x)).toBeGreaterThan(5*.43);
 expect(pieces.length).toBe(DEBRIS_POOL_SIZE);fx.dispose();expect(scene.meshes.length).toBe(0);scene.dispose();engine.dispose();
});
it("uses the same eighteen meshes through rapid cascades and fades them independently of platform reuse",()=>{
 const engine=new NullEngine(),scene=new Scene(engine),fx=new DirectedDebris(scene);
 const baseline=[scene.meshes.length,scene.materials.length,scene.textures.length];
 for(let i=0;i<80;i++){fx.emit(i,-i*4,0,3,i,160,i%2?0:1);fx.update(.01,{x:i,y:-i*4-1},160);}
 expect([scene.meshes.length,scene.materials.length,scene.textures.length]).toEqual(baseline);
 expect(scene.meshes.every(m=>m.parent===null&&!m.isPickable)).toBe(true);
 fx.update(2,{x:0,y:-1000},160);expect(scene.meshes.every(m=>!m.isEnabled())).toBe(true);
 fx.dispose();scene.dispose();engine.dispose();
});
