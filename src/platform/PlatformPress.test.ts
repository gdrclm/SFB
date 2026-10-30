import {expect,it} from "vitest";
import {NullEngine} from "@babylonjs/core/Engines/nullEngine";
import {Scene} from "@babylonjs/core/scene";
import {Mesh} from "@babylonjs/core/Meshes/mesh";
import {VertexBuffer} from "@babylonjs/core/Buffers/buffer";
import {PlatformSprite} from "./PlatformSprites";
it("bends stone locally at the actual hit, opens a small hole and restores its idle geometry on reuse",()=>{
 const engine=new NullEngine(),scene=new Scene(engine),parent=new Mesh("stone",scene),sprite=new PlatformSprite(parent,.3,1,scene);
 sprite.render(4,0,0);sprite.startPress(4,0,.7);
 const before=Array.from(sprite.mesh.getVerticesData(VertexBuffer.PositionKind)??[]);
 sprite.renderPress(1,1,1);const after=Array.from(sprite.mesh.getVerticesData(VertexBuffer.PositionKind)??[]);
 let near=0,far=0;
 for(let i=0;i<before.length;i+=3){const depth=(before[i+1]??0)-(after[i+1]??0);if(Math.abs((before[i]??0)-.7)<.2)near=Math.max(near,depth);if((before[i]??0)<-1.5)far=Math.max(far,depth);}
 expect(near).toBeGreaterThan(.25);expect(far).toBeLessThan(.01);
 expect(sprite.mesh.metadata).toMatchObject({impactX:.7,impactCrack:1,impactHole:1});
 sprite.renderCollapse(4,.1);expect(sprite.mesh.scaling.y).toBe(1);
 sprite.resetImpact();sprite.render(4,0,1);
 expect((sprite.mesh.metadata as {impactHole?:number}).impactHole).toBeUndefined();expect(sprite.mesh.scaling.y).toBe(1);
 scene.dispose();engine.dispose();
});
