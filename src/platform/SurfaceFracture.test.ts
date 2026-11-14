import { expect, it } from "vitest";
import { SurfaceFracture, SURFACE_FRAGMENT_COUNT, SURFACE_FRAGMENT_VERTICES } from "./SurfaceFracture";

const bounds={left:-2,right:2,bottom:-1.5,top:.5};
function fracture(speed=10,reduced=false):SurfaceFracture{
 const geometry=new SurfaceFracture();geometry.prepare(bounds,4,.4,speed,7,"solid",reduced);return geometry;
}

it("partitions the whole painted body into irregular pieces without losing mass",()=>{
 for(const width of [.8,3,7.5])for(const seed of [0,1,15,140]){
  const geometry=new SurfaceFracture(),b={...bounds,left:-width/2,right:width/2};
  geometry.prepare(b,width,width*.4,10,seed,"solid");
  expect(geometry.pieces).toHaveLength(SURFACE_FRAGMENT_COUNT);
  let area=0;
  for(const piece of geometry.pieces){
   expect(piece.polygon.length).toBeGreaterThanOrEqual(3);
   expect(piece.polygon.length+2).toBeLessThanOrEqual(SURFACE_FRAGMENT_VERTICES);
   area+=Math.abs(piece.polygon.reduce((sum,p,i)=>{
    const next=piece.polygon[(i+1)%piece.polygon.length];if(!next)throw Error("Missing polygon point");return sum+p.x*next.y-next.x*p.y;
   },0))/2;
   for(const p of piece.polygon){expect(p.x).toBeGreaterThanOrEqual(b.left-1e-8);expect(p.x).toBeLessThanOrEqual(b.right+1e-8);}
  }
  expect(area).toBeCloseTo(width*2,8);
  expect([...geometry.positions,...geometry.uvs].every(Number.isFinite)).toBe(true);
 }
});

it("throws full-size textured pieces visibly even at starting speed and keeps their UVs fixed",()=>{
 const geometry=fracture(),original=geometry.positions.slice(),uvs=geometry.uvs.slice();
 geometry.update(.25);
 for(let i=0;i<SURFACE_FRAGMENT_COUNT;i++){
  const n=i*SURFACE_FRAGMENT_VERTICES*3;
  expect(Math.abs((geometry.positions[n]??NaN)-(original[n]??NaN))).toBeGreaterThan(.5);
  expect(geometry.positions[n+1]).toBeLessThan((original[n+1]??NaN)-.5);
  // Rotation and translation preserve the size of every triangle; no shrinking to tiny particles.
  const oldEdge=Math.hypot((original[n+3]??NaN)-(original[n]??NaN),(original[n+4]??NaN)-(original[n+1]??NaN));
  const newEdge=Math.hypot((geometry.positions[n+3]??NaN)-(geometry.positions[n]??NaN),(geometry.positions[n+4]??NaN)-(geometry.positions[n+1]??NaN));
  expect(newEdge).toBeCloseTo(oldEdge,5);
 }
 expect(geometry.uvs).toEqual(uvs);
});

it("uses analytic trajectories, reuses its buffers and respects reduced motion",()=>{
 const coarse=fracture(80),fine=fracture(80),reduced=fracture(80,true),original=coarse.positions.slice();
 const buffers=[coarse.positions,coarse.uvs,coarse.shardData,coarse.indices];
 coarse.update(.4);for(let i=0;i<=40;i++)fine.update(i/100);reduced.update(.4);
 expect(coarse.positions).toEqual(fine.positions);
 const displacement=(geometry:SurfaceFracture)=>Math.hypot((geometry.positions[0]??NaN)-(original[0]??NaN),(geometry.positions[1]??NaN)-(original[1]??NaN));
 expect(displacement(reduced)).toBeLessThan(displacement(coarse)*.2);
 coarse.prepare(bounds,4,-.6,12,9,"liquid");coarse.update(.3);
 [coarse.positions,coarse.uvs,coarse.shardData,coarse.indices].forEach((buffer,index)=>{expect(buffer).toBe(buffers[index]);});
});
