import { expect,it } from "vitest";
import { ballActivity } from "./BallActivity";
it("uses four distinct speed poses with increasing cadence",()=>{
  const profiles=[10,30,60,120].map(speed=>ballActivity(speed));
  expect(profiles.map(p=>p.mode)).toEqual(["drift","paddle","dive","surge"]);
  for(let i=1;i<profiles.length;i++) expect(profiles[i]?.cadence).toBeGreaterThan(profiles[i-1]?.cadence??0);
  expect(ballActivity(10000).pulse).toBeLessThanOrEqual(.06);
});
