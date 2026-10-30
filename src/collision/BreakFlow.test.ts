import {expect,it} from "vitest";
import {BreakFlow,materialBreakTiming} from "./BreakFlow";
import {speedAfterBreak} from "./BreakResistance";
it("earns three seconds of power from six manual overmatched hits and requires a continuous chain to refresh it",()=>{
 const flow=new BreakFlow();
 for(let i=0;i<5;i++){flow.hit(.4);flow.update(.3);expect(flow.powerSeconds).toBe(0);}
 flow.hit(.4);expect(flow.powerSeconds).toBe(3);expect(flow.reserve).toBeGreaterThan(.8);
 flow.update(.5);flow.hit(.4);expect(flow.powerSeconds).toBe(3);
 flow.update(0);expect(flow.powerSeconds).toBe(3);
 flow.update(1);expect(flow.streak).toBe(0);flow.hit(.4);expect(flow.powerSeconds).toBe(2);
 flow.reset();expect([flow.reserve,flow.streak,flow.powerSeconds]).toEqual([0,0,0]);
});
it("preserves earned momentum without creating speed or changing the platform threshold",()=>{
 const plain=speedAfterBreak(80,25,.02,.6),flow=speedAfterBreak(80,25,.02,.6,1);
 expect(flow).toBeGreaterThan(plain);expect(flow).toBeLessThanOrEqual(80);
 const chain=new BreakFlow();chain.hit(.3);chain.hit(.3);chain.hit(.95);expect(chain.streak).toBe(0);
 chain.update(3);expect(chain.reserve).toBe(0);expect(chain.powerSeconds).toBe(0);
});
it("shortens material resistance with excess speed but leaves a readable delayed rupture behind a very fast ball",()=>{
 expect(materialBreakTiming(80,20).press).toBeLessThan(materialBreakTiming(22,20).press);
 const fast=materialBreakTiming(160,20);expect(fast.press).toBeLessThan(.025);
 expect(fast.rupture-fast.press).toBeGreaterThan(.07);expect(fast.rupture).toBeLessThan(.12);
});
