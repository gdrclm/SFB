import { expect,it,vi } from "vitest";
import { BallController } from "../ball/BallController";
import { gameConfig } from "../config/gameConfig";
import { MechanicPacing } from "./MechanicPacing";
import { PlatformMechanics } from "./PlatformMechanics";
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
