import {expect,it} from "vitest";
import {BreakFlow,FLOW_SECONDS,FLOW_MAX_SECONDS,materialBreakTiming} from "./BreakFlow";
import {speedAfterBreak} from "./BreakResistance";
it("earns eight seconds of flow from six fast manual overmatched hits",()=>{
 const flow=new BreakFlow();
 for(let i=0;i<5;i++){flow.hit(.4,80);flow.update(.3);expect(flow.powerSeconds).toBe(0);}
 flow.hit(.4,80);expect(flow.powerSeconds).toBe(FLOW_SECONDS);expect(flow.reserve).toBeGreaterThan(.8);
 flow.update(0);expect(flow.powerSeconds).toBe(FLOW_SECONDS);
 flow.update(FLOW_SECONDS);expect(flow.powerSeconds).toBe(0);
 flow.reset();expect([flow.reserve,flow.streak,flow.powerSeconds]).toEqual([0,0,0]);
});
it("keeps low-speed momentum but requires high speed and a continuous chain for entry",()=>{
 const flow=new BreakFlow();
 for(let i=0;i<20;i++)flow.hit(.3,20);
 expect(flow.reserve).toBe(1);expect(flow.powerSeconds).toBe(0);expect(flow.streak).toBe(0);
 for(let i=0;i<5;i++)flow.hit(.3,80);
 flow.update(1.41);flow.hit(.3,80);expect(flow.streak).toBe(1);expect(flow.powerSeconds).toBe(0);
 for(let i=0;i<20;i++)flow.hit(.95,80);
 expect(flow.streak).toBe(0);expect(flow.powerSeconds).toBe(0);
});
it("extends successful flow without allowing a permanent activation",()=>{
 const flow=new BreakFlow();
 for(let i=0;i<6;i++)flow.hit(.3,80);
 for(let i=0;i<40;i++){flow.update(.1);flow.hit(.3,80);}
 expect(flow.powerSeconds).toBeCloseTo(FLOW_MAX_SECONDS-4);
 flow.update(7.99);expect(flow.powerSeconds).toBeCloseTo(.01);
 flow.update(.02);expect(flow.powerSeconds).toBe(0);expect(flow.streak).toBe(0);
 flow.hit(.3,80);expect(flow.powerSeconds).toBe(0);expect(flow.streak).toBe(1);
});
it("uses elapsed time consistently and ignores invalid input",()=>{
 const at=(fps:number)=>{
  const flow=new BreakFlow();for(let i=0;i<6;i++)flow.hit(.3,80);
  for(let i=0;i<fps*3;i++)flow.update(1/fps);
  return flow.powerSeconds;
 };
 expect(at(30)).toBeCloseTo(at(144),10);
 const flow=new BreakFlow();
 for(const speed of [NaN,Infinity,-1])flow.hit(.3,speed);
 for(const ratio of [NaN,Infinity,-1])flow.hit(ratio,80);
 for(const dt of [0,-1,NaN,Infinity])flow.update(dt);
 expect([flow.reserve,flow.streak,flow.powerSeconds]).toEqual([0,0,0]);
});
it("preserves earned momentum without creating speed or changing the platform threshold",()=>{
 const plain=speedAfterBreak(80,25,.02,.6),flow=speedAfterBreak(80,25,.02,.6,1);
 expect(flow).toBeGreaterThan(plain);expect(flow).toBeLessThanOrEqual(80);
 const chain=new BreakFlow();chain.hit(.3,80);chain.hit(.3,80);chain.hit(.95,80);expect(chain.streak).toBe(0);
 chain.update(3);expect(chain.reserve).toBe(0);expect(chain.powerSeconds).toBe(0);
});
it("shortens material resistance with excess speed but leaves a readable delayed rupture behind a very fast ball",()=>{
 expect(materialBreakTiming(80,20).press).toBeLessThan(materialBreakTiming(22,20).press);
 const fast=materialBreakTiming(160,20);expect(fast.press).toBeLessThan(.025);
 expect(fast.rupture-fast.press).toBeGreaterThan(.07);expect(fast.rupture).toBeLessThan(.12);
});
