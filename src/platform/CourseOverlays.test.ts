import {expect,it} from "vitest";
import {gameConfig} from "../config/gameConfig";
import {atStartDepth} from "../dev/DeveloperMode";
import {courseOverlay} from "./CourseOverlays";
import {PlatformRoutePlanner,type PlannedPlatform} from "./PlatformRoutePlanner";
import {courseMechanic} from "./PlatformMechanic";
const difficulty={stageNumber:7,platformStrength:80,reactionWindowSeconds:.8};
function planner(depth:number){const config=atStartDepth(gameConfig,depth);return new PlatformRoutePlanner(config.ball.startPosition.y,config,()=>.3);}
function members(plan:PlannedPlatform){return[{...plan,yOffset:0},...(plan.choices??[])];}

it("layers dynamic decisions over existing course beats and leaves acceleration and recovery clean",()=>{
 for(const phase of ["introduction","development","climax"] as const){
  for(const theme of ["trap","rich-lane","death-tunnel"] as const)for(const row of [2,5])expect(courseMechanic(theme,"sky",phase,row)).toBeUndefined();
  for(let row=0;row<20;row++)for(const section of ["breather","run-up"] as const)expect(courseOverlay(section,"crystal",phase,row)).toBeUndefined();
  for(let row=0;row<20;row++)for(const section of ["maneuver","tension","cascade","loot","climax"] as const)expect(courseOverlay(section,"sky",phase,row)).toBeUndefined();
 }
 expect(courseOverlay("maneuver","crystal","introduction",5)).toBe("moving-gap");
 expect(courseOverlay("tension","crystal","introduction",5)).toBe("turret-volley");
 expect(courseOverlay("cascade","crystal","development",2)).toBe("moving-gap");
 expect(courseOverlay("cascade","crystal","development",5)).toBe("turret-volley");
 expect(courseOverlay("cascade","crystal","climax",5)).toBe("turret-volley");
 expect(courseOverlay("climax","crystal","climax",6)).toBe("moving-gap");
 expect(courseOverlay("climax","crystal","climax",14)).toBe("turret-volley");
});
it.each([20,45,80,160])("offers a genuinely travelling slit and a permanent alternative outside the full sweep at %s speed",speed=>{
 const p=planner(500);const plans=Array.from({length:32},()=>p.planNext(speed,3,difficulty));
 const gap=plans.find(plan=>plan.overlay==="moving-gap");
 if(!gap?.movingPassage||!gap.passage)throw Error("Missing moving-gap lesson");
 expect(gap.movingPassage.width-2*gap.movingPassage.amplitude).toBeLessThan(gameConfig.ball.radius*2);
 const ledges=members(gap);expect(ledges).toHaveLength(2);
 for(const member of ledges){
  const motion=member.lateralMotion??gap.lateralMotion;
  expect(motion?.phase).toBe(gap.movingPassage.phase);expect(motion?.amplitude).toBe(gap.movingPassage.amplitude);
  for(const shift of [-gap.movingPassage.amplitude,0,gap.movingPassage.amplitude]){
   expect(Math.abs(member.x+shift-gap.passage.x)-member.widthScale*7.5/2).toBeGreaterThanOrEqual(gap.passage.width/2);
  }
 }
 expect(ledges.every(member=>(member.yOffset??0)===0)).toBe(true);
});
it.each([20,45,80,160])("groups three descending turrets with authored firing intervals and reserves the whole band's exit at %s speed",speed=>{
 const p=planner(1400),plans=Array.from({length:70},()=>p.planNext(speed,3,difficulty));
 const group=plans.find(plan=>plan.overlay==="turret-volley");
 if(!group)throw Error("Missing stepped volley");
 const sources=members(group);expect(sources).toHaveLength(3);
 for(const [i,source] of sources.entries()){
  expect(source.mechanic).toBe("turret");
  expect(source.turretVolley).toEqual({id:group.turretVolley?.id,index:i,count:3});
  if(i>0){
   const step=(sources[i-1]?.yOffset??0)-(source.yOffset??0);
   expect(step).toBeGreaterThanOrEqual(1.85);expect(step).toBeLessThanOrEqual(4.5);
  }
 }
 expect(group.bandDepth).toBeGreaterThanOrEqual(-(sources[2]?.yOffset??0));
 const next=plans[plans.indexOf(group)+1];
 expect(group.y-(group.bandDepth??0)-(next?.y??0)).toBeGreaterThan(1.75+speed/3*.24);
});
it("marks one completion per full phrase and gates depth-driven crystal development on actually passed sequences",()=>{
 const p=planner(900);p.setCompletedSequences(0);
 const plans=Array.from({length:42},()=>p.planNext(20,3,difficulty));
 expect(plans.every(plan=>plan.location==="crystal"&&plan.worldPhase==="introduction")).toBe(true);
 const endings=plans.filter(plan=>plan.sequenceEnd);
 expect(endings).toHaveLength(6);expect(new Set(endings.map(plan=>plan.sequenceId)).size).toBe(6);
 p.setCompletedSequences(6,"crystal");
 const following=Array.from({length:12},()=>p.planNext(20,3,difficulty));
 expect(following.some(plan=>plan.worldPhase==="development")).toBe(true);
 expect(following.slice(0,2).every(plan=>plan.worldPhase==="introduction")).toBe(true);
});
it("requires twelve passed phrases before depth can promote development to climax and waits for the current phrase to finish",()=>{
 const p=planner(2150);p.setCompletedSequences(0);
 const plans=Array.from({length:30},()=>p.planNext(20,3,difficulty));
 expect(plans.every(plan=>plan.location==="crystal"&&plan.worldPhase==="development")).toBe(true);
 p.setCompletedSequences(12,"crystal");
 const following=Array.from({length:16},()=>p.planNext(20,3,difficulty));
 expect(following.some(plan=>plan.worldPhase==="climax")).toBe(true);
 const firstClimax=following.findIndex(plan=>plan.worldPhase==="climax");
 expect(firstClimax).toBeGreaterThan(0);expect(following[firstClimax-1]?.sequenceEnd).toBe(true);
});
