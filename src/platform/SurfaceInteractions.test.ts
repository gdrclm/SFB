import { expect, it, vi } from "vitest";
import { BallController } from "../ball/BallController";
import { gameConfig } from "../config/gameConfig";
import type { PlatformController } from "./PlatformController";
import { surfaceForCourse, surfaceHits, SURFACES, type PlatformSurface } from "./PlatformSurfaces";
import { SurfaceInteractions } from "./SurfaceInteractions";
function platform(surface:PlatformSurface,strength=15,seed=0):PlatformController{
 const p={surface,surfaceSeed:seed,strength,isActive:true,activationId:1,width:4,size:{height:.3,depth:1,width:4},surfaceLockX:0,
  mesh:{position:{x:0,y:0,z:0}},surfaceState:{hits:surfaceHits(surface,seed),cells:255,charge:0,infection:0},
  setSurfaceStrength(value:number){this.strength=Math.ceil(value);},setSurfaceVisual(v:Partial<typeof this.surfaceState>){Object.assign(this.surfaceState,v);},
  setSurfaceCells(mask:number){this.surfaceState.cells=mask;},transmuteSurface(type:PlatformSurface,value:number){this.surface=type;this.strength=Math.ceil(value);},
 };
 return p as unknown as PlatformController;
}
function fixture(type:PlatformSurface,strength=15,seed=0){
 const p=platform(type,strength,seed),platforms=[p];let enabled=true,immune=false,depth=0;
 const position={x:0,y:0,z:0};
 const ball=new BallController({position},{isActive:false,normalizedPosition:0},gameConfig);
 ball.fallSpeed=20;
 const actions={bounce:vi.fn(),chip:vi.fn(),destroy:vi.fn((p:PlatformController)=>{Object.assign(p,{isActive:false});}),hurt:vi.fn(),feather:vi.fn(),discover:vi.fn(()=>true)};
 const system=new SurfaceInteractions(ball,()=>platforms,actions,()=>enabled,()=>immune,()=>depth);
 return {p,ball,position,platforms,actions,system,hit:(speed=ball.fallSpeed,x=0)=>system.beforeHit({platform:p,ballSpeed:speed,assessment:speed>=p.strength?"sufficient":"insufficient",contact:{x,y:.65,z:0}}),
  disable:()=>{enabled=false;},protect:()=>{immune=true;},depth:(value:number)=>{depth=value;}};
}
it("generates every requested surface in its world, progressively, and preserves later-world themes",()=>{
 const found=new Set<PlatformSurface>();
 for(const [location,depth]of[["sky",0],["sky",80],["sky",200],["crystal",510],["crystal",700],["crystal",1000]]as const)
  for(let i=0;i<32;i++){const s=surfaceForCourse(location,depth,i);if(s)found.add(s);}
 expect([...found].sort()).toEqual([...SURFACES].sort());
 for(let i=0;i<20;i++){expect(surfaceForCourse("sky",0,i)).not.toBe("storm");expect(surfaceForCourse("lava",4000,i)).toBeUndefined();}
});
it("makes clouds harmless and cushions vertical travel without erasing earned speed",()=>{
 const f=fixture("cloud",100);expect(f.hit()).toBe(false);expect(f.p.strength).toBe(1);
 f.system.destroyed(f.p);f.ball.fixedUpdate(.02);
 expect(f.ball.fallSpeed).toBeGreaterThanOrEqual(20);expect(Math.abs(f.ball.verticalVelocity)).toBeLessThan(3);
 f.ball.fixedUpdate(.2);expect(Math.abs(f.ball.verticalVelocity)).toBeGreaterThan(6);
});
it("springs off weak bubble impacts without losing speed, then permits a burst with a directional gust",()=>{
 const f=fixture("bubble",30);
 expect(f.hit()).toBe(true);expect(f.actions.bounce).toHaveBeenCalledOnce();expect(f.ball.fallSpeed).toBe(20);
 for(let i=0;i<39;i++){f.ball.fixedUpdate(1/60);expect(f.ball.position.y).toBeGreaterThanOrEqual(.65-1e-8);}
 expect(f.ball.isBouncing).toBe(false);expect(f.hit()).toBe(false);
 f.system.destroyed(f.p);f.ball.fixedUpdate(.1);expect(f.ball.position.x).not.toBe(0);
});
it.each(["island","balloons"]as const)("shows and removes individual %s layers before a full break",type=>{
 const f=fixture(type,15,3);expect(f.p.surfaceState.hits).toBe(3);
 expect(f.hit()).toBe(true);expect(f.p.surfaceState.hits).toBe(2);
 f.ball.fixedUpdate(.65);expect(f.hit()).toBe(true);expect(f.p.surfaceState.hits).toBe(1);
 f.ball.fixedUpdate(.65);expect(f.hit()).toBe(false);
});
it("pops the last balloon harmlessly even when the bundle was stronger than the player",()=>{
 const f=fixture("balloons",100);expect(f.hit()).toBe(true);
 f.ball.fixedUpdate(.65);expect(f.hit()).toBe(true);
 f.ball.fixedUpdate(.65);expect(f.hit()).toBe(false);expect(f.p.strength).toBe(1);
});
it.each([30,60,120])("keeps a fast safe rebound above its contact until recovery at %i Hz",fps=>{
 const f=fixture("bubble",1000);f.ball.fallSpeed=600;expect(f.hit()).toBe(true);
 while(f.ball.isBouncing){f.ball.fixedUpdate(1/fps);expect(f.ball.position.y).toBeGreaterThanOrEqual(.65-1e-8);}
 expect(f.ball.fallSpeed).toBe(600);expect(f.ball.verticalVelocity).toBeCloseTo(-200);
});
it("holds a web briefly and releases it, with BOOST permitting an earlier escape",()=>{
 for(const boosted of [false,true]){
  const f=fixture("web");expect(f.hit()).toBe(true);
  f.ball.fixedUpdate(.1);expect(f.ball.position.y).toBe(.65);
  if(boosted)f.ball.fallSpeed=40;
  f.system.fixedUpdate(boosted?.05:.23);
  expect(f.actions.destroy).toHaveBeenCalledWith(f.p);
 }
});
it("only unlocks laser barriers at their visible lock and makes missed beams a safe rebound",()=>{
 const hit=fixture("laser",200);expect(hit.hit(20,0)).toBe(false);expect(hit.p.strength).toBe(1);
 const miss=fixture("laser",200);expect(miss.hit(20,1.2)).toBe(true);expect(miss.actions.bounce).toHaveBeenCalledOnce();
 expect(miss.actions.hurt).not.toHaveBeenCalled();
});
it("opens real honeycomb holes, weakens neighbours and collapses a key cell",()=>{
 const f=fixture("honeycomb");expect(f.hit(20,-1.8)).toBe(true);expect(f.p.surfaceState.cells&3).toBe(0);
 expect(f.hit(20,-.75)).toBe(false);expect(f.p.strength).toBe(1);
});
it.each(["storm","spikes"]as const)("warns before the %s burst and never charges multiple lives for one pulse",type=>{
 const f=fixture(type);f.position.y=1;f.system.destroyed(f.p);
 f.system.fixedUpdate(.3);expect(f.actions.hurt).not.toHaveBeenCalled();
 f.system.fixedUpdate(.25);expect(f.actions.hurt).toHaveBeenCalledOnce();f.system.fixedUpdate(.1);expect(f.actions.hurt).toHaveBeenCalledOnce();
});
it("emits bounded sharp crystal hazards with a dodge grace period, and suppresses them under plasma",()=>{
 const f=fixture("crystal");f.system.destroyed(f.p);expect(f.system.events.filter(e=>e.active&&e.kind==="shard")).toHaveLength(3);
 f.system.fixedUpdate(.2);expect(f.actions.hurt).not.toHaveBeenCalled();
 for(let i=0;i<30;i++)f.system.destroyed(f.p);expect(f.system.events).toHaveLength(32);
 const protectedRun=fixture("crystal");protectedRun.system.destroyed(protectedRun.p,true);expect(protectedRun.system.events.some(e=>e.active)).toBe(false);
});
it("makes nest birds decorative and lets a falling feather grant the jump reward",()=>{
 const f=fixture("nest");f.system.destroyed(f.p);expect(f.system.events.filter(e=>e.active&&e.kind==="bird")).toHaveLength(3);
 const feather=f.system.events.find(e=>e.active&&e.kind==="feather");if(!feather)throw Error("Missing feather");
 f.position.x=feather.x;f.position.y=feather.y;f.system.fixedUpdate(.01);expect(f.actions.feather).toHaveBeenCalledOnce();
});
it("uses visible magnetic attraction and leaves a short-lived slowing liquid pool",()=>{
 const magnet=fixture("magnet");magnet.position.x=1;magnet.position.y=2;magnet.system.fixedUpdate(.02);magnet.ball.fixedUpdate(.1);
 expect(magnet.ball.position.x).toBeLessThan(1);
 const liquid=fixture("liquid");liquid.system.destroyed(liquid.p);liquid.position.y=0;liquid.system.fixedUpdate(.02);liquid.ball.fixedUpdate(.02);
 expect(Math.abs(liquid.ball.verticalVelocity)).toBeLessThan(4);liquid.system.fixedUpdate(2.1);expect(liquid.system.events.some(e=>e.active)).toBe(false);
});
it("chains only matching resonance groups in range, without recursive skill rewards",()=>{
 const f=fixture("resonance",15,1),matching=platform("resonance",50,1),wrong=platform("resonance",10,2),distant=platform("resonance",10,1);
 distant.mesh.position.x=20;f.platforms.push(matching,wrong,distant);f.system.destroyed(f.p);
 expect(f.actions.destroy).toHaveBeenCalledTimes(1);expect(f.actions.destroy).toHaveBeenCalledWith(matching);
});
it("isolates training, telegraphs crystallization near the rift, and resets pooled activation state",()=>{
 const f=fixture("cloud");f.disable();expect(f.hit()).toBe(false);expect(f.p.strength).toBe(15);f.system.destroyed(f.p);expect(f.system.events.some(e=>e.active)).toBe(false);
 const infected=fixture("cloud");infected.depth(480);infected.position.y=1;infected.system.fixedUpdate(.1,1.5);
 expect(infected.p.surfaceState.infection).toBe(.5);expect(infected.system.events.some(e=>e.active&&e.kind==="rift")).toBe(true);
 infected.system.fixedUpdate(.1,1.5);expect(infected.p.surface).toBe("crystal");
});
