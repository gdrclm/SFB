import { expect, it } from "vitest";
import { WaterSplashGeometry, WATER_SPLASH_SECONDS } from "./WaterSplashGeometry";

function visible(water: WaterSplashGeometry): number {
 let count=0;
 for(let i=1;i<water.waterData.length;i+=2) if(water.waterData[i]>0) count++;
 return count;
}
function range(water: WaterSplashGeometry, x: number, y: number): number {
 let radius=0;
 for(let slot=0;slot<water.waterData.length/8;slot++){
  if((water.waterData[slot*8+1]??0)<=0)continue;
  for(let vertex=0;vertex<4;vertex++){
   const index=slot*12+vertex*3;
   radius=Math.max(radius,Math.hypot((water.positions[index]??0)-x,(water.positions[index+1]??0)-y));
  }
 }
 return radius;
}
it("expands a dense starburst quickly, opens up, then leaves separated drops",()=>{
 const water=new WaterSplashGeometry();
 const originalPositions=water.positions,originalData=water.waterData,originalUvs=water.uvs;
 water.update(.025,1,1.2,.25,false);
 const initial=range(water,1.2,.25);
 expect(visible(water)).toBeGreaterThan(100);
 water.update(.16,1,1.2,.25,false);
 const peak=range(water,1.2,.25);
 expect(peak).toBeGreaterThan(initial*2);
 expect(water.waterData.some((shape,i)=>i%2===0&&shape===2&&(water.waterData[i+1]??0)>0)).toBe(true);
 expect(water.waterData.some((shape,i)=>i%2===0&&shape===3&&(water.waterData[i+1]??0)>0)).toBe(true);
 water.update(.45,1,1.2,.25,false);
 expect(visible(water)).toBeLessThan(visibleAt(.16));
 water.update(.7,1,1.2,.25,false);
 expect(visible(water)).toBeGreaterThan(0);
 expect(water.positions).toBe(originalPositions);
 expect(water.waterData).toBe(originalData);
 expect(water.uvs).toBe(originalUvs);
 expect(water.update(WATER_SPLASH_SECONDS,1,1.2,.25,false)).toBe(0);
 expect(water.waterData.every(value=>value===0)).toBe(true);
});
function visibleAt(age:number):number{
 const water=new WaterSplashGeometry();
 water.update(age,1,1.2,.25,false);
 return visible(water);
}
it("honors reduced motion with a much smaller and sparser splash",()=>{
 const water=new WaterSplashGeometry();
 water.update(.16,1,0,0,false);
 const fullRange=range(water,0,0),fullVisible=visible(water);
 const allocated=water.positions.length;
 water.update(.16,1,0,0,true);
 expect(range(water,0,0)).toBeLessThan(fullRange*.6);
 expect(visible(water)).toBeLessThan(fullVisible*.4);
 expect(water.positions.length).toBe(allocated);
});
it("reuses a fixed batch and safely clears invalid or expired frames",()=>{
 const water=new WaterSplashGeometry();
 const indices=water.indices.slice(),pos=water.positions,data=water.waterData;
 for(const time of [.0,.08,.12,.24,.44,.65]){
  expect(water.update(time,1,0,0,false)).toBeGreaterThan(0);
  expect(water.positions).toBe(pos);expect(water.waterData).toBe(data);
  expect(water.indices).toEqual(indices);
 }
 for(const time of [-1,Number.NaN,WATER_SPLASH_SECONDS]){
  expect(water.update(time,1,0,0,false)).toBe(0);
  expect(visible(water)).toBe(0);
 }
});
