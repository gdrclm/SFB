import { expect,it } from "vitest";
import { WaterSplashGeometry,WATER_SPLASH_SECONDS } from "./WaterSplashGeometry";
function center(positions:Float32Array,quad:number):{x:number;y:number}{
 let x=0,y=0;for(let i=0;i<4;i++){x+=positions[quad*12+i*3]??0;y+=positions[quad*12+i*3+1]??0;}return{x:x/4,y:y/4};
}
it("sends shaped droplets out from the hit, lets gravity bring them down and keeps continuous water jets",()=>{
 const water=new WaterSplashGeometry(),positions=water.positions,attributes=water.waterData;
 water.update(.1,1,1.2,.25,false);const early=center(water.positions,0);
 water.update(.3,1,1.2,.25,false);const peak=center(water.positions,0);
 expect(peak.x).toBeLessThan(early.x);expect(peak.y).toBeGreaterThan(early.y);
 expect(Math.max(...water.positions.filter((_,i)=>i%3===1))).toBeGreaterThan(1.3);
 expect(water.waterData.some((shape,i)=>i%2===0&&shape===1&&(water.waterData[i+1]??0)>0)).toBe(true);
 water.update(.7,1,1.2,.25,false);expect(center(water.positions,0).y).toBeLessThan(peak.y);
 expect(water.positions).toBe(positions);expect(water.waterData).toBe(attributes);
 expect(water.update(WATER_SPLASH_SECONDS,1,1.2,.25,false)).toBe(0);
 expect(water.waterData.every(value=>value===0)).toBe(true);
});
it("keeps reduced-motion splashes smaller and sparser and never exceeds its fixed batch",()=>{
 const water=new WaterSplashGeometry();water.update(.2,1,0,0,false);
 const fullRange=Math.max(...water.positions.filter((_,i)=>i%3===0));
 const fullVisible=water.waterData.filter((_,i)=>i%2===1).filter(alpha=>alpha>0).length;
 const length=water.positions.length;water.update(.2,1,0,0,true);
 expect(Math.max(...water.positions.filter((_,i)=>i%3===0))).toBeLessThan(fullRange*.6);
 expect(water.waterData.filter((_,i)=>i%2===1).filter(alpha=>alpha>0).length).toBeLessThan(fullVisible);
 expect(water.positions.length).toBe(length);
});
