import {expect,it} from "vitest";
import {SURFACES,customSurfaceArt} from "./PlatformSurfaces";
import {surfaceAnimation,surfaceAnimationLayout,surfaceDestroyLayout,surfaceIdleFrames,surfaceBreakFrames} from "./SurfaceAnimation";
it("addresses six separate idle and six destruction source cells for all new platforms and every machine variant",()=>{
 const kinds=[...SURFACES.filter(customSurfaceArt),"moving","wind-left","wind-right","turret"] as const;
 for(const kind of kinds){
  const art=surfaceAnimation(kind);if(!art)throw Error(`Missing animation ${kind}`);
  for(const frames of [art.idle,art.destroy]){
   expect(frames).toHaveLength(6);expect(new Set(frames.map(rect=>rect[0])).size).toBe(6);
   for(let i=0;i<6;i++){const r=frames[i];if(!r)throw Error("Missing source frame");expect(r[0]).toBeGreaterThanOrEqual(0);expect(r[1]).toBeGreaterThanOrEqual(0);expect(r[0]+r[2]).toBeLessThanOrEqual(1.000001);expect(r[1]+r[3]).toBeLessThanOrEqual(1.000001);}
  }
  const layout=surfaceAnimationLayout(art,4),broken=surfaceDestroyLayout(art,layout);
  expect(layout[2]+(.5-art.rim)*layout[1]).toBeCloseTo(.15);
  expect(broken.every(Number.isFinite)).toBe(true);
 }
 expect(surfaceAnimation("wind-left")).toBe(surfaceAnimation("wind-right"));
});
it("blends the last real idle pose back to the first without a jump, and reaches the sixth destruction pose",()=>{
 const before=surfaceIdleFrames(2.4-.000001),after=surfaceIdleFrames(2.4);
 expect(before[0]).toBe(5);expect(before[1]).toBe(0);expect(before[2]).toBeGreaterThan(.9999);expect(after).toEqual([0,1,0]);
 expect(surfaceBreakFrames(.5)).toEqual([3,4,0]);expect(surfaceBreakFrames(1)).toEqual([5,5,0]);
 expect(surfaceIdleFrames(100,7,true)).toEqual([0,0,0]);expect(surfaceBreakFrames(.8,true)).toEqual([2,2,0]);
});
