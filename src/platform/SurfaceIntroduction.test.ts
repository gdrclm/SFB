import { expect,it } from "vitest";
import { SurfaceIntroduction, type IntroductionRow } from "./SurfaceIntroduction";
import { PlatformRoutePlanner } from "./PlatformRoutePlanner";
import { gameConfig } from "../config/gameConfig";
import type { PlatformSurface } from "./PlatformSurfaces";
function row(overrides:Partial<IntroductionRow>={}):IntroductionRow{return {location:"sky",phase:"introduction",section:"run-up",sequence:0,row:0,rows:8,ordinal:0,machine:false,eligible:[true,true],...overrides};}
it("prepares a lesson, introduces a single type alone, repeats it and saves combinations for later phrases",()=>{
 const course=new SurfaceIntroduction();
 expect(course.row(row())).toEqual(["island","island"]);expect(course.row(row({row:1}))).toEqual(["island","island"]);
 expect(course.row(row({row:2}))).toEqual(["cloud","island"]);expect(course.row(row({row:3}))).toEqual(["island","island"]);
 expect(course.row(row({row:5}))).toEqual(["cloud","island"]);
 for(let i=0;i<4;i++)expect(course.row(row({section:"breather",sequence:1,row:i})).every(t=>t==="island"||t==="cloud")).toBe(true);
});
it("keeps first surface lessons off the existing crystal machine beats and leaves recovery free of new types",()=>{
 const course=new SurfaceIntroduction(500);
 for(let i=0;i<8;i++){
  const machine=i===2||i===5;const surfaces=course.row(row({location:"crystal",section:"maneuver",row:i,machine,eligible:machine?[false,false]:[true,true]}));
  if(i<6)expect(surfaces.every(s=>s===undefined||s==="crystal")).toBe(true);
  else expect(surfaces).toEqual(["hologram","crystal"]);
 }
 for(let i=0;i<4;i++)expect(course.row(row({location:"crystal",section:"breather",sequence:1,row:i}))).toEqual(["crystal","crystal"]);
});
it("only introduces resonance when the visible group contains another matching block",()=>{
 const course=new SurfaceIntroduction(500);
 const lessons=["hologram","laser","honeycomb","magnet","liquid","resonance"] as const;
 const sections=["maneuver","loot","cascade","maneuver","tension","cascade"] as const;
 for(let sequence=0;sequence<lessons.length;sequence++){
  const section=sections[sequence];if(!section)throw Error("Missing section");
  for(let i=0;i<8;i++)course.row(row({location:"crystal",section,sequence,row:i,eligible:sequence===5?[true]:[true,true]}));
 }
 expect(course.lesson).toBeUndefined();
 const pair=course.row(row({location:"crystal",section:"cascade",sequence:6,row:2}));expect(pair).toEqual(["resonance","resonance"]);
});
it("does not replay introduction on a developer start inside an advanced world phase",()=>{
 const course=new SurfaceIntroduction(2500);
 const types=course.row(row({location:"crystal",phase:"climax",section:"tension",row:0,ordinal:0}));
 expect(types).toContain("spikes");expect(course.lesson).toBeUndefined();
});
it("introduces at most one new surface per real generated phrase, never on a machine row or in a breather",()=>{
 for(const startDepth of [0,500]){
  const planner=new PlatformRoutePlanner(0,{...gameConfig,startDepth},()=>.3),known=new Map<string,Set<PlatformSurface>>(),byPhrase=new Map<number,Set<PlatformSurface>>();
  for(let i=0;i<280;i++){
   const p=planner.planNext(15,0,{stageNumber:6,platformStrength:12,reactionWindowSeconds:.8});
   const location=p.location??"sky",seen=known.get(location)??new Set<PlatformSurface>(location==="sky"?["island"]:["crystal"]);known.set(location,seen);
   for(const member of [p,...p.choices??[]])if(member.surface&&!seen.has(member.surface)){
    expect(p.section).not.toBe("breather");expect(p.mechanic).toBeUndefined();
    const phrase=byPhrase.get(p.sequenceId??0)??new Set<PlatformSurface>();phrase.add(member.surface);byPhrase.set(p.sequenceId??0,phrase);expect(phrase.size).toBe(1);seen.add(member.surface);
   }
  }
 }
});
