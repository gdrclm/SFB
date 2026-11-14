import type { BallController } from "../ball/BallController";
import type { PlatformCollision } from "../collision/CollisionResolver";
import type { PlatformController } from "./PlatformController";
import { projectileHitsBall } from "./PlatformMechanics";
import type { PlatformSurface } from "./PlatformSurfaces";

export type SurfaceEventKind = "shock" | "shard" | "puddle" | "feather" | "bird" | "wave" | "rift" | "earth" | "gust";
export interface SurfaceEvent {
 kind: SurfaceEventKind; active: boolean; x: number; y: number; vx: number; vy: number; age: number; life: number;
 delay: number; radius: number; seed: number; source: PlatformController | null; activation: number; used: boolean;
}
interface ContactState { activation: number; touches: number; release: number; speed: number; infection: number }
export interface SurfaceActions {
 bounce(): void; chip(platform: PlatformController): void; destroy(platform: PlatformController): void;
 hurt(platform: PlatformController): void; feather(): void;
 discover?(surface:PlatformSurface):boolean;
}
/** Gameplay state is per activation; all detached FX/hazards share one bounded pool. */
export class SurfaceInteractions {
 readonly events: SurfaceEvent[] = Array.from({length:32},()=>({kind:"wave",active:false,x:0,y:0,vx:0,vy:0,age:0,life:1,delay:0,radius:1,seed:0,source:null,activation:0,used:false}));
 readonly #states = new WeakMap<PlatformController,ContactState>();
 #time=0; #cursor=0; #riftShown=false;
 readonly #seen=new Set<PlatformSurface>();#nextHint=0;
 public constructor(private readonly ball: BallController, private readonly platforms:()=>readonly PlatformController[],
  private readonly actions:SurfaceActions, private readonly enabled:()=>boolean, private readonly immune:()=>boolean,
  private readonly depth:()=>number, private readonly movementScale=1/3) {}
 #state(p:PlatformController):ContactState {
  let s=this.#states.get(p);if(!s||s.activation!==p.activationId){s={activation:p.activationId,touches:0,release:Infinity,speed:0,infection:0};this.#states.set(p,s);}return s;
 }
 #emit(kind:SurfaceEventKind,p:PlatformController|null,x:number,y:number,life:number,delay=0,radius=1,vx=0,vy=0,seed=0):void {
  const e=this.events.find(e=>!e.active)??this.events[this.#cursor++%this.events.length];if(!e)return;
  Object.assign(e,{kind,active:true,x,y,vx,vy,age:0,life,delay,radius,seed,source:p,activation:p?.activationId??0,used:false});
 }
 public beforeHit(c:PlatformCollision,powered=false):boolean {
  if(!this.enabled()||powered)return false;
  const p=c.platform,type=p.surface;if(!type)return false;
  const s=this.#state(p),x=c.contact?.x??this.ball.position.x;
  const y=c.contact?.y??p.mesh.position.y+p.size.height/2+.5;
  if(type==="cloud"||type==="liquid")p.setSurfaceStrength(1);
  if(type==="laser") {
   const lock=p.mesh.position.x+p.surfaceLockX;
   if(Math.abs(x-lock)<.48){p.setSurfaceStrength(1);return false;}
   this.#spring(p,y,x);return true;
  }
  if(type==="web") {
   if(s.release!==Infinity)return true;
   s.release=this.#time+.22;s.speed=c.ballSpeed;p.setSurfaceVisual({charge:0});
   this.ball.startBreakImpact(y,1,x,.22);this.actions.chip(p);return true;
  }
  if(type==="bubble"&&c.ballSpeed<p.strength&&s.touches++===0){
   p.setSurfaceStrength(Math.max(1,c.ballSpeed*.75));this.#spring(p,y,x);return true;
  }
  if(type==="honeycomb") {
   const cell=Math.max(0,Math.min(7,Math.floor((x-p.mesh.position.x+p.width/2)/p.width*8)));
   let removed=0;
   const neighbours=Math.max(1,Math.ceil(.65/(p.width/8)));
   for(let i=Math.max(0,cell-neighbours);i<=Math.min(7,cell+neighbours);i++)removed|=1<<i;
   const mask=p.surfaceState.cells&~removed;
   p.setSurfaceCells(mask);this.actions.chip(p);
   if(mask===0||cell===2||cell===5){p.setSurfaceStrength(1);return false;}
   this.ball.applyContactDrag(.65,.12);return true;
  }
  if((type==="island"||type==="balloons")&&p.surfaceState.hits>1&&(type==="balloons"||c.ballSpeed>=p.strength)){
   if(c.ballSpeed>=p.strength*1.75){p.setSurfaceVisual({hits:1});return false;}
   p.setSurfaceVisual({hits:p.surfaceState.hits-1});this.#spring(p,y,x);return true;
  }
  if(type==="balloons")p.setSurfaceStrength(1);
  return false;
 }
 #spring(p:PlatformController,y:number,x:number):void {
  if(this.ball.startBounce(y,x,true)){this.actions.chip(p);this.actions.bounce();}
 }
 public destroyed(p:PlatformController,powered=false):void {
  if(!this.enabled()||!p.surface)return;
  const x=p.mesh.position.x,y=p.mesh.position.y,type=p.surface;
  if(type==="cloud")this.ball.applyContactDrag(.38,.18);
  if(type==="island")for(let i=0;i<5;i++)this.#emit("earth",null,x+(i-2)*p.width*.12,y-.2,.85,0,.22+(i%2)*.12,(i-2)*1.4,-1-i*.25,i);
  if(type==="bubble"){
   const direction=p.surfaceSeed%2?1:-1;
   this.ball.applyLateralImpulse(direction*5,.32);
   this.#emit("gust",null,x,y,.45,0,1.5,direction*2,0,direction);
  }
  if(type==="nest") {
   for(let i=0;i<3;i++)this.#emit("bird",null,x,y,1.6,0,.3,(i%2?1:-1)*(2+i),1+i*.3,i);
   this.#emit("feather",null,x+(p.surfaceSeed%2?.65:-.65),y-.8,4,0,.35,0,-.5);
  }
  if(type==="liquid")this.#emit("puddle",p,x,y,2,0,Math.max(1,p.width/2));
  if(type==="resonance") {
   this.#emit("wave",null,x,y,.65,0,8,0,0,p.surfaceSeed%3);
   // Secondary breaks never grant skill combo/BOOST and cannot recurse.
   for(const other of this.platforms())if(other!==p&&other.isActive&&other.surface==="resonance"
    &&other.surfaceSeed%3===p.surfaceSeed%3&&Math.hypot(other.mesh.position.x-x,other.mesh.position.y-y)<=8)this.actions.destroy(other);
  }
  if(powered)return;
  if(type==="storm"||type==="spikes")this.#emit("shock",p,x,y,1,.5,2.3,0,0,type==="storm"?0:1);
  if(type==="crystal")for(let i=0;i<3;i++)this.#emit("shard",p,x+(i-1)*.35,y-.5,1.3,.35,.18,
   (i-1)*2.2,-Math.max(1,this.ball.fallSpeed*this.movementScale*.55),i);
 }
 public fixedUpdate(seconds:number,realSeconds=seconds):void {
  if(!this.enabled()){for(const e of this.events)e.active=false;return;}
  this.#time+=realSeconds;
  const pos=this.ball.position;
  for(const p of this.platforms())if(p.isActive){
   const s=this.#state(p),gap=pos.y-p.mesh.position.y;
   if(p.surface&&!this.#seen.has(p.surface)&&this.#time>=this.#nextHint&&gap>0
    &&gap<Math.max(6,this.ball.fallSpeed*this.movementScale*1.5)
    &&Math.abs(pos.x-p.mesh.position.x)<p.width/2+.5&&this.actions.discover?.(p.surface)){
    this.#seen.add(p.surface);this.#nextHint=this.#time+3;
   }
   if(p.surface==="web"&&s.release!==Infinity)p.setSurfaceVisual({charge:Math.max(0,1-(s.release-this.#time)/.22)});
   if(p.surface==="web"&&s.release!==Infinity&&(this.#time>=s.release||this.ball.fallSpeed>s.speed*1.15)){
    s.release=Infinity;this.actions.destroy(p);
   }
   if(p.surface==="magnet"&&gap>0&&gap<5&&Math.abs(pos.x-p.mesh.position.x)<3.5&&!this.immune()){
    this.ball.applyLateralImpulse(Math.max(-4,Math.min(4,(p.mesh.position.x-pos.x)*2)),.15);
    p.setSurfaceVisual({charge:Math.max(0,1-gap/5)});
   }
   if(p.surface==="cloud"&&this.depth()>400&&this.depth()<500&&gap>0&&gap<2.5){
    s.infection+=realSeconds;p.setSurfaceVisual({infection:Math.min(1,s.infection/3)});
    if(s.infection>=3)p.transmuteSurface("crystal",this.ball.fallSpeed*1.25);
   }
  }
  if(!this.#riftShown&&this.depth()>=480&&this.depth()<500){
   this.#riftShown=true;this.#emit("rift",null,0,pos.y-(500-this.depth()),3,0,12);
  }
  for(const e of this.events)if(e.active){
   const oldX=e.x,oldY=e.y;e.age+=realSeconds;e.x+=e.vx*seconds;e.y+=e.vy*seconds;
   if(e.kind==="earth")e.vy-=9*seconds;
   if(e.age>=e.life){e.active=false;continue;}
   if(e.kind==="puddle"&&!e.used&&Math.hypot(pos.x-e.x,(pos.y-e.y)*1.8)<e.radius){e.used=true;this.ball.applyContactDrag(.5,.35);}
   if(e.kind==="feather"&&projectileHitsBall(oldX,oldY,e.x,e.y,this.ball.previousPosition,pos,.8)){
    e.active=false;this.ball.grantFeather();this.actions.feather();
   }
   if(e.used||e.age<e.delay||this.immune()||!e.source||e.source.activationId!==e.activation)continue;
   const hit=e.kind==="shock"?Math.hypot(pos.x-e.x,pos.y-e.y)<e.radius
    :e.kind==="shard"&&projectileHitsBall(oldX,oldY,e.x,e.y,this.ball.previousPosition,pos,.5+e.radius);
   if(hit){e.used=true;this.actions.hurt(e.source);}
  }
 }
}
