import { expect,it,vi } from "vitest";
import { PlatformMechanics,projectileHitsBall,type MechanicPlatform } from "./PlatformMechanics";
import type { PlatformMechanic } from "./PlatformMechanic";
function fixture(kind:PlatformMechanic="turret") {
  const ball={position:{x:0,y:12,z:0},previousPosition:{x:0,y:12,z:0},fallSpeed:30};
  const platform={isActive:true,activationId:1,mechanic:kind,width:2,mesh:{position:{x:0,y:0,z:0}}};
  const wind=vi.fn(),hit=vi.fn();let enabled=true;
  const model=new PlatformMechanics(ball,()=>[platform],()=>({left:-8,right:8,bottom:-2,top:20}),1/3,.5,wind,hit,()=>enabled);
  return {ball,platform,model,wind,hit,disable:()=>{enabled=false;}};
}
function advance(model:PlatformMechanics,seconds:number):void{for(let i=0;i<Math.round(seconds*60);i++)model.fixedUpdate(1/60);}
it("telegraphs a turret before firing, keeps its aim fixed and fires once per activation",()=>{
  const {model,ball,hit}=fixture();
  advance(model,.5);expect(model.projectiles.every(p=>!p.active)).toBe(true);
  expect(model.cues[0]?.charge).toBeGreaterThan(.5);
  ball.position.x=5;ball.previousPosition.x=5;
  expect(model.cues[0]?.aimX).toBe(0);
  advance(model,.3);
  const shot=model.projectiles.find(p=>p.active);
  expect(shot).toBeDefined();expect(shot?.vx).toBe(0);
  advance(model,6);
  expect(hit).not.toHaveBeenCalled();expect(model.projectiles.every(p=>!p.active)).toBe(true);
});
it("hits once, cancels projectiles when a turret breaks and resets a recycled activation",()=>{
  const f=fixture();advance(f.model,2);
  expect(f.hit).toHaveBeenCalledTimes(1);
  advance(f.model,4);expect(f.hit).toHaveBeenCalledTimes(1);
  const g=fixture();advance(g.model,.8);expect(g.model.projectiles.some(p=>p.active)).toBe(true);
  g.platform.isActive=false;g.model.fixedUpdate(1/60);
  expect(g.model.projectiles.every(p=>!p.active)).toBe(true);
  g.platform.activationId++;g.platform.isActive=true;
  advance(g.model,.2);expect(g.hit).not.toHaveBeenCalled();
  expect(g.model.projectiles.every(p=>!p.active)).toBe(true);
});
it("warns before a directional gust and applies it once, while disabled mechanics do nothing",()=>{
  const f=fixture("wind-left");f.ball.fallSpeed=10;f.ball.position.y=3;f.ball.previousPosition.y=3;
  advance(f.model,.5);expect(f.wind).not.toHaveBeenCalled();
  f.ball.position.y=1.5;advance(f.model,.1);
  expect(f.wind).toHaveBeenCalledExactlyOnceWith(-1);
  advance(f.model,3);expect(f.wind).toHaveBeenCalledTimes(1);
  f.disable();f.model.fixedUpdate(1/60);expect(f.model.cues).toHaveLength(0);
});
it("sweeps projectiles against the ball path instead of missing high-speed crossings",()=>{
  expect(projectileHitsBall(0,0,0,1,{x:0,y:20,z:0},{x:0,y:-20,z:0},.6)).toBe(true);
  expect(projectileHitsBall(0,0,0,1,{x:4,y:20,z:0},{x:4,y:-20,z:0},.6)).toBe(false);
});
it("keeps a bounded visible cue set and one charging turret across wide-screen duplicates",()=>{
  const f=fixture();
  const platforms:MechanicPlatform[]=Array.from({length:40},(_,i)=>({...f.platform,mesh:{position:{x:(i%4)-2,y:-Math.floor(i/4),z:0}}}));
  const model=new PlatformMechanics(f.ball,()=>platforms,()=>({left:-10,right:10,bottom:-20,top:20}),1/3,.5,f.wind,f.hit);
  advance(model,.5);
  expect(model.cues.length).toBeLessThanOrEqual(8);
  expect(model.cues.filter(c=>c.charge>0)).toHaveLength(1);
  expect(model.projectiles).toHaveLength(4);
});
