import {expect,it} from "vitest";
import {CloudBurstGeometry,CLOUD_BURST_SECONDS,cloudSplitGap} from "./CloudBurstGeometry";
const visible=(cloud:CloudBurstGeometry):number=>cloud.waterData.filter((value,i)=>i%8===1&&value>0).length;
it("releases lobes after the impact wave reaches them and fades the fixed batch completely",()=>{
 const cloud=new CloudBurstGeometry(),positions=cloud.positions,data=cloud.waterData;
 cloud.update(.2,4,1.2,-.4,1,false);expect(visible(cloud)).toBe(0);
 cloud.update(.30,4,1.2,-.4,1,false);
 const right=data.slice(-8),left=data.slice(0,8);
 expect(right[1]).toBeGreaterThan(0);expect(left[1]).toBe(0);
 cloud.update(.60,4,1.2,-.4,1,false);expect(visible(cloud)).toBe(12);
 cloud.update(1.15,4,1.2,-.4,1,false);expect(visible(cloud)).toBeLessThan(12);
 expect(cloud.positions).toBe(positions);expect(cloud.waterData).toBe(data);
 expect(cloud.update(CLOUD_BURST_SECONDS,4,1.2,-.4,1,false)).toBe(0);
 expect(data.every(value=>value===0)).toBe(true);
});
it("separates the halves smoothly and limits drift and puff count for reduced motion",()=>{
 expect(cloudSplitGap(0,1,false)).toBe(0);
 expect(cloudSplitGap(.25,1,false)).toBeGreaterThan(0);
 expect(cloudSplitGap(.25,1,false)).toBeLessThan(cloudSplitGap(.50,1,false));
 expect(cloudSplitGap(.50,1,true)).toBeCloseTo(cloudSplitGap(.50,1,false)*.25);
 const cloud=new CloudBurstGeometry();cloud.update(.6,4,0,-.4,1,false);
 const normalRange=Math.max(...cloud.positions.filter((_,i)=>i%3===0));
 cloud.update(.6,4,0,-.4,1,true);expect(visible(cloud)).toBe(4);
 expect(Math.max(...cloud.positions.filter((_,i)=>i%3===0))).toBeLessThan(normalRange);
});
