import { expect,it,vi } from "vitest";
import { BallController } from "../ball/BallController";
import { gameConfig } from "../config/gameConfig";
import { MechanicPacing } from "./MechanicPacing";
import { PlatformMechanics } from "./PlatformMechanics";
import { TURRET_VOLLEY_INTERVAL } from "./PlatformMechanics";
import type { PlatformMechanic } from "./PlatformMechanic";

function fixture(kind:PlatformMechanic="moving",speed=80) {
  const config={...gameConfig,ball:{...gameConfig.ball,naturalAcceleration:0}};
  const input={isActive:false,isImmediate:true,normalizedPosition:1};
  const ball=new BallController({position:{x:0,y:0,z:0}},input,config);ball.fallSpeed=speed;
  const platform={isActive:true,activationId:1,mechanic:kind,width:3,mesh:{position:{x:0,y:-28,z:0}}};
  const view=()=>({left:-10,right:10,bottom:ball.position.y-20,top:ball.position.y+10});
  const notify=vi.fn();let enabled=true;
  const pacing=new MechanicPacing(ball,()=>[platform],view,1/3,()=>enabled,notify);
  return {ball,input,platform,pacing,view,notify,disable:()=>{enabled=false;}};
}
it.each([45,80,160])("gives the first machine at least two visible seconds at %s speed without losing momentum",speed=>{
  const f=fixture("moving",speed);let visible=0;
  for(let i=0;i<1200&&f.ball.position.y>f.platform.mesh.position.y;i++) {
    f.pacing.fixedUpdate(1/60);f.ball.fixedUpdate(1/60);
    if(f.platform.mesh.position.y>=f.view().bottom)visible+=1/60;
  }
  expect(visible).toBeGreaterThan(2);expect(visible).toBeLessThan(4);
  expect(f.ball.fallSpeed).toBe(speed);expect(f.notify).toHaveBeenCalledTimes(1);
  for(let i=0;i<90;i++){f.pacing.fixedUpdate(1/60);f.ball.fixedUpdate(1/60);}
  expect(f.pacing.scale).toBeGreaterThan(.999);
  f.platform.mesh.position.y=f.ball.position.y-15;f.platform.activationId++;
  f.pacing.fixedUpdate(1/60);expect(f.pacing.scale).toBeGreaterThan(.999);
  f.platform.mechanic="wind-right";f.pacing.fixedUpdate(1/60);
  expect(f.pacing.scale).toBeLessThan(.95);expect(f.notify).toHaveBeenCalledTimes(2);
});
it("keeps steering in real time, restores on bounce and disables safely for training or immunity",()=>{
  const f=fixture();f.input.isActive=true;
  f.platform.mesh.position.y=-24;
  f.pacing.fixedUpdate(.1);f.ball.fixedUpdate(.1);
  expect(f.ball.position.x).toBeCloseTo(1.6);
  expect(f.ball.fallSpeed).toBe(80);expect(f.pacing.scale).toBeLessThan(1);
  f.disable();f.pacing.fixedUpdate(1/60);expect(f.pacing.scale).toBe(1);
  const g=fixture();g.platform.mesh.position.y=-24;g.pacing.fixedUpdate(.1);expect(g.pacing.scale).toBeLessThan(1);g.ball.startBounce(g.ball.position.y);g.pacing.fixedUpdate(1/60);
  expect(g.pacing.scale).toBe(1);
});
it.each(["turret","wind-right"] as const)("lets %s complete its visible behavior before the first pass",kind=>{
  const f=fixture(kind),wind=vi.fn(),hit=vi.fn();let fired=false;
  const model=new PlatformMechanics(f.ball,()=>[f.platform],f.view,1/3,.5,wind,hit);
  for(let i=0;i<600&&f.ball.position.y>f.platform.mesh.position.y;i++) {
    f.pacing.fixedUpdate(1/60);f.ball.fixedUpdate(1/60);model.fixedUpdate(1/60);
    fired ||= model.projectiles.some(p=>p.active)||hit.mock.calls.length>0;
  }
  if(kind==="turret")expect(fired).toBe(true);else expect(wind).toHaveBeenCalledTimes(1);
});
it("does not stack the introductory descent reduction on top of an already slow world",()=>{
  const f=fixture();f.platform.mesh.position.y=-24;
  f.pacing.fixedUpdate(.01,.1);
  expect(f.pacing.scale).toBe(1);
});
it.each([20,45,80,160,320])("keeps repeated three-shot volleys readable at %s earned speed with a short twenty-unit viewport",speed=>{
  const config={...gameConfig,ball:{...gameConfig.ball,naturalAcceleration:0}};
  const ball=new BallController({position:{x:0,y:0,z:0}},{isActive:false,isImmediate:true,normalizedPosition:0},config);ball.fallSpeed=speed;
  const platforms:{isActive:boolean;activationId:number;mechanic:"turret";width:number;mesh:{position:{x:number;y:number;z:number}};turretVolley:{id:string;index:number;count:number}}[]=[];
  const view=()=>({left:-10,right:10,bottom:ball.position.y-20,top:ball.position.y+10}),notify=vi.fn();
  const pacing=new MechanicPacing(ball,()=>platforms,view,1/3,()=>true,notify);
  const model=new PlatformMechanics(ball,()=>platforms,view,1/3,.5,vi.fn(),vi.fn());
  for(const id of ["first","repeat"]){
    const origin=ball.position.y-28;
    const step=Math.min(4.5,Math.max(1.55,speed/3*TURRET_VOLLEY_INTERVAL));
    const group=Array.from({length:3},(_,index)=>({isActive:true,activationId:1,mechanic:"turret" as const,width:3,
      mesh:{position:{x:index%2?2.8:-2.8,y:origin-step*index,z:0}},turretVolley:{id,index,count:3}}));
    platforms.push(...group);
    const last=group.at(-1);if(!last)throw new Error("Missing last volley step");
    const fired=new Set<number>(),warnings=new Map<number,number>();let simulationAge=0;
    for(let frame=0;frame<1000&&ball.position.y>last.mesh.position.y;frame++){
      pacing.fixedUpdate(1/60);ball.fixedUpdate(1/60);model.fixedUpdate(1/60);simulationAge+=1/60;
      const top=group[0];if(top&&ball.position.y<=top.mesh.position.y)top.isActive=false;
      for(const cue of model.cues.filter(c=>c.charge>0&&c.platform.turretVolley?.id===id)){
        const index=cue.platform.turretVolley?.index;if(index!==undefined)warnings.set(index,(warnings.get(index)??0)+1/60);
      }
      for(const shot of model.projectiles){
        const member=shot.source?.turretVolley;if(shot.active&&shot.age<.02&&member?.id===id&&!fired.has(member.index)){
          expect(warnings.get(member.index)).toBeGreaterThanOrEqual(.45-1e-8);
          expect(shot.source?.mesh.position.y).toBeLessThan(ball.position.y);fired.add(member.index);
        }
      }
      expect(ball.fallSpeed).toBe(speed);
    }
    expect([...fired],id).toEqual([0,1,2]);expect(simulationAge).toBeLessThan(8);
    for(const platform of group)platform.isActive=false;
    for(let frame=0;frame<150;frame++){pacing.fixedUpdate(1/60);ball.fixedUpdate(1/60);model.fixedUpdate(1/60);}
  }
  expect(notify).toHaveBeenCalledTimes(1);expect(pacing.scale).toBeGreaterThan(.99);
});
