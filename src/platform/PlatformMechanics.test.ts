import { expect,it,vi } from "vitest";
import { PlatformMechanics,projectileHitsBall,TURRET_VOLLEY_INTERVAL,TURRET_VOLLEY_WARNING,type MechanicPlatform } from "./PlatformMechanics";
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

function volleyFixture(speed=80,visibleSeconds=2.5){
  const world=speed/3,ball={position:{x:0,y:world*1.4,z:0},previousPosition:{x:0,y:world*1.4,z:0},fallSpeed:speed};
  const platforms=Array.from({length:3},(_,index)=>({isActive:true,activationId:1,mechanic:"turret" as const,width:2,
    mesh:{position:{x:index%2?3:-3,y:-world*TURRET_VOLLEY_INTERVAL*index,z:0}},turretVolley:{id:"phrase-1",index,count:3}}));
  const all:MechanicPlatform[]=[...platforms],hit=vi.fn();
  const model=new PlatformMechanics(ball,()=>all,()=>({left:-8,right:8,bottom:ball.position.y-world*visibleSeconds,top:ball.position.y+world}),1/3,.5,vi.fn(),hit);
  return{model,ball,platforms,all,hit,world};
}
it.each([20,45,80,160])("fires all three warned descending steps serially at %s speed without a global-cooldown gap",speed=>{
  const f=volleyFixture(speed),times=new Map<number,number>();
  for(let frame=0;frame<100;frame++){
    f.ball.previousPosition={...f.ball.position};f.ball.position.y-=f.world/60;
    if(frame===2)f.ball.position.x=5;
    f.model.fixedUpdate(1/60);
    for(const shot of f.model.projectiles){const index=shot.source?.turretVolley?.index;if(shot.active&&shot.age<.02&&index!==undefined&&!times.has(index))times.set(index,f.model.age);}
    expect(f.model.cues.length).toBeLessThanOrEqual(8);
    for(const cue of f.model.cues.filter(c=>c.charge>0))expect(cue.aimX).toBe(0);
  }
  expect([...times.keys()]).toEqual([0,1,2]);expect(times.get(0)).toBeGreaterThanOrEqual(TURRET_VOLLEY_WARNING);
  for(let i=1;i<3;i++){const gap=(times.get(i)??0)-(times.get(i-1)??0);expect(gap).toBeGreaterThanOrEqual(TURRET_VOLLEY_INTERVAL-1e-8);expect(gap).toBeLessThan(.36);}
  expect(f.model.projectiles).toHaveLength(4);expect(f.hit).not.toHaveBeenCalled();
});
it("keeps an active volley's warnings visible among nearby side-cell duplicates",()=>{
  const f=volleyFixture();f.model.fixedUpdate(1/60);
  f.all.push(...Array.from({length:40},(_,i)=>({isActive:true,activationId:1,mechanic:"turret" as const,width:2,mesh:{position:{x:(i%4)-2,y:f.ball.position.y-1-i*.02,z:0}}})));
  advance(f.model,.25);
  expect(f.model.cues.filter(c=>c.charge>0)).toHaveLength(3);
  expect(f.model.cues.length).toBeLessThanOrEqual(8);
  expect(f.model.cues.filter(c=>c.charge>0).every(c=>c.platform.turretVolley?.id==="phrase-1")).toBe(true);
});
it("cancels a recycled volley member and protected-mode cleanup never leaves a pending burst",()=>{
  const f=volleyFixture();advance(f.model,.55);
  const first=f.model.projectiles.find(p=>p.active);expect(first?.source).toBe(f.platforms[0]);
  const top=f.platforms[0],middle=f.platforms[1];if(!top||!middle)throw new Error("Missing volley members");
  top.isActive=false;middle.activationId++;
  f.model.fixedUpdate(1/60);expect(first?.active).toBe(false);
  advance(f.model,.5);expect(f.model.projectiles.some(p=>p.active&&p.source===middle)).toBe(false);
  f.model.clear();expect(f.model.cues).toHaveLength(0);expect(f.model.projectiles.every(p=>!p.active)).toBe(true);
  advance(f.model,1);expect(f.model.projectiles.every(p=>!p.active)).toBe(true);
});
it("waits for every member of an incrementally allocated side-cell group before warning and firing it",()=>{
  const f=volleyFixture(),pending=f.all.splice(1);
  advance(f.model,.6);expect(f.model.cues.every(c=>c.charge===0)).toBe(true);expect(f.model.projectiles.every(p=>!p.active)).toBe(true);
  f.all.push(...pending);advance(f.model,.30);expect(f.model.cues.filter(c=>c.charge>0)).toHaveLength(3);
  expect(f.model.projectiles.every(p=>!p.active)).toBe(true);
  advance(f.model,.25);expect(f.model.projectiles.some(p=>p.active)).toBe(true);
});
