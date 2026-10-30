import {VertexBuffer} from "@babylonjs/core/Buffers/buffer";
import {Vector3} from "@babylonjs/core/Maths/math.vector";
import type {Mesh} from "@babylonjs/core/Meshes/mesh";
import type {Scene} from "@babylonjs/core/scene";
import {createAtlasSprite,setAtlasQuad} from "../platform/PlatformSprites";
import {debrisSpriteRect,PLATFORM_ATLAS_SIZE,type PlatformSpriteRow} from "../platform/PlatformSpriteLayout";

export const DEBRIS_POOL_SIZE=18;
interface Fragment{mesh:Mesh;velocity:Vector3;uvs:Float32Array;age:number;life:number;scale:number;fine:boolean;spin:number}
/** One world-space pool for the whole run, not one emitter per platform. */
export class DirectedDebris {
 readonly #pieces:Fragment[]=[];
 #cursor=0;
 public constructor(scene:Scene,private readonly reduced=false,private readonly travelScale=1/3){
  for(let i=0;i<DEBRIS_POOL_SIZE;i++){
   const mesh=createAtlasSprite(`DirectedDebris-${String(i)}`,scene),rect=debrisSpriteRect(0,i);
   setAtlasQuad(mesh,rect,1,rect.height/rect.width);mesh.setEnabled(false);
   this.#pieces.push({mesh,velocity:Vector3.Zero(),uvs:new Float32Array(8),age:1,life:0,scale:1,fine:false,spin:0});
  }
 }
 public emit(x:number,y:number,z:number,width:number,contactX:number,speed:number,row:PlatformSpriteRow):void{
  const power=Math.max(0,Math.min(1,(speed-25)/75)),fall=Math.max(2,speed*this.travelScale);
  const count=this.reduced?6:DEBRIS_POOL_SIZE;
  for(let i=0;i<count;i++){
   const p=this.#pieces[this.#cursor++%DEBRIS_POOL_SIZE];if(!p)continue;
   const seed=(i*.618+.23)%1,edge=i>=9&&i<13,fine=i>=13,side=i%2?-1:1;
   const offset=edge?side*width*.43:fine?(seed-.5)*.8:(i/8-.5)*width*.65;
   const rect=debrisSpriteRect(row,i),u=rect.x/PLATFORM_ATLAS_SIZE.width,v=1-(rect.y+rect.height)/PLATFORM_ATLAS_SIZE.height;
   const du=rect.width/PLATFORM_ATLAS_SIZE.width,dv=rect.height/PLATFORM_ATLAS_SIZE.height;
   p.uvs.set([u,v,u+du,v,u+du,v+dv,u,v+dv]);p.mesh.updateVerticesData(VertexBuffer.UVKind,p.uvs);
   p.mesh.metadata={spriteAtlas:"neon-rocks",row,group:fine?"fine":edge?"edge":"mass"};
   p.mesh.position.set(fine?contactX+offset:x+offset,y-.20-seed*.30,z-.08);
   p.velocity.set(edge?side*(3.5+seed*2)*(1-power*.55):(contactX-p.mesh.position.x)*power*1.2+side*(.35+seed*.8),
    -fall*(fine?.94+seed*.10:edge?.32+seed*.24:.54+seed*.22)-1.3,0);
   if(this.reduced)p.velocity.x*=.25;
   p.age=0;p.life=fine?.58+seed*.15:.42+seed*.15;p.fine=fine;
   p.scale=(fine?.10+seed*.09:edge?.27+seed*.15:.38+seed*.20)*Math.min(1.3,.8+width*.06);
   p.spin=side*(1+seed*4)*(this.reduced?.2:1);
   p.mesh.rotation.set(0,0,side*seed*.7);p.mesh.scaling.setAll(p.scale);p.mesh.visibility=.9;p.mesh.setEnabled(true);
  }
 }
 public update(seconds:number,target:Readonly<{x:number;y:number}>,fallSpeed:number):void{
  for(const p of this.#pieces){
   if(p.age>=p.life)continue;
   const dt=Math.max(0,Math.min(seconds,p.life-p.age));p.age+=dt;
   if(p.fine&&target.y<p.mesh.position.y){
    const blend=1-Math.exp(-dt*7);
    p.velocity.x+=(Math.max(-6,Math.min(6,(target.x-p.mesh.position.x)*3))-p.velocity.x)*blend;
    const chase=-Math.max(0,fallSpeed)*this.travelScale-(p.mesh.position.y-target.y)*2;
    p.velocity.y+=(chase-p.velocity.y)*blend;
   }else p.velocity.y-=18*dt;
   p.mesh.position.addInPlaceFromFloats(p.velocity.x*dt,p.velocity.y*dt,0);
   p.mesh.rotation.z+=p.spin*dt;
   const remaining=Math.max(0,1-p.age/p.life);
   p.mesh.scaling.set(p.scale*(.6+remaining*.4),p.scale*(p.fine?1.5:1)*(.6+remaining*.4),1);
   p.mesh.visibility=Math.min(1,remaining/.45)**1.4*.85;
   if(p.age>=p.life)p.mesh.setEnabled(false);
  }
 }
 public dispose():void{for(const p of this.#pieces)p.mesh.dispose();}
}
