import type { DepthLocation } from "../scene/DepthLocations";
import { worldProgression, type WorldPhase } from "../progression/WorldProgression";
import type { CourseSection } from "./CourseSections";
import type { PlatformSurface } from "./PlatformSurfaces";

const lessons:Partial<Record<DepthLocation,readonly PlatformSurface[]>>={
 sky:["cloud","bubble","nest","balloons","web","storm"],
 crystal:["hologram","laser","honeycomb","magnet","liquid","resonance","spikes"],
};
const compatibility:Partial<Record<PlatformSurface,readonly CourseSection[]>>={
 cloud:["run-up","cascade","loot"],bubble:["cascade","maneuver","loot"],nest:["loot","cascade"],balloons:["loot","maneuver"],web:["maneuver","tension","loot"],storm:["tension","climax"],
 hologram:["maneuver","loot"],laser:["loot","maneuver"],honeycomb:["cascade","run-up"],magnet:["loot","maneuver"],liquid:["maneuver","tension"],resonance:["cascade","loot"],spikes:["tension","climax"],
};
const palettes:Record<"sky"|"crystal",Record<CourseSection,readonly PlatformSurface[]>>={
 sky:{"run-up":["island"],cascade:["island"],breather:["island","cloud","nest"],loot:["nest","balloons","island"],maneuver:["bubble","web","island"],tension:["storm","web","island"],climax:["island"]},
 crystal:{"run-up":["crystal","resonance"],cascade:["crystal","honeycomb","resonance"],breather:["crystal"],loot:["resonance","laser","magnet","crystal"],maneuver:["hologram","laser","liquid","magnet","crystal"],tension:["spikes","laser","liquid","crystal"],climax:["crystal"]},
};
export interface IntroductionRow {
 readonly location:DepthLocation;readonly phase:WorldPhase;readonly section:CourseSection;
 readonly sequence:number;readonly row:number;readonly rows:number;readonly ordinal:number;readonly machine:boolean;
 readonly eligible:readonly boolean[];
}
interface Phrase {sequence:number;lesson:PlatformSurface|undefined;allowed:ReadonlySet<PlatformSurface>;shown:boolean;first:number;repeat:number}
/** Introduce a vocabulary item alone, repeat it, then use it in later phrases.
 * Only placement changes: contacts, damage, strengths and abilities are untouched. */
export class SurfaceIntroduction {
 readonly #known=new Map<DepthLocation,Set<PlatformSurface>>();
 #phrase:Phrase|undefined;
 public lesson:PlatformSurface|undefined;
 public constructor(startDepth=0){
  const start=worldProgression(startDepth);
  if(start.phase!=="introduction")this.#known.set(start.location,new Set(lessons[start.location]));
 }
 public row(c:IntroductionRow):readonly (PlatformSurface|undefined)[]{
  if(c.location!=="sky"&&c.location!=="crystal")return c.eligible.map(()=>undefined);
  const base=c.location==="sky"?"island":"crystal";
  let known=this.#known.get(c.location);if(!known){known=new Set();this.#known.set(c.location,known);}known.add(base);
  if(this.#phrase?.sequence!==c.sequence){
   const next=lessons[c.location]?.find(type=>!known.has(type));
   const lesson=c.section!=="breather"&&next&&(c.section==="climax"||compatibility[next]?.includes(c.section))?next:undefined;
   let first=2,repeat=5;
   if(c.location==="crystal"&&["maneuver","loot","tension"].includes(c.section)){
    first=c.rows>=8?6:0;repeat=c.rows>=8?7:1;
   }
   if(c.section==="climax"){
    first=lesson==="storm"||lesson==="spikes"?12:lesson==="nest"||lesson==="balloons"?8:lesson==="resonance"||lesson==="honeycomb"?2:4;repeat=first+1;
   }
   this.#phrase={sequence:c.sequence,lesson,allowed:new Set(known),shown:false,first,repeat};
  }
  const phrase=this.#phrase;this.lesson=undefined;
  const selected=c.eligible.flatMap((eligible,index)=>eligible?[index]:[]);
  const result:(PlatformSurface|undefined)[]=c.eligible.map(eligible=>eligible?base:undefined);
  if(c.machine||selected.length===0)return result;
  const demonstrate=phrase.lesson&&(!phrase.shown&&c.row>=phrase.first||phrase.shown&&c.row===phrase.repeat);
  if(demonstrate&&phrase.lesson&&(phrase.lesson!=="resonance"||selected.length>=2)){
   const first=selected[0];if(first!==undefined)result[first]=phrase.lesson;
   if(phrase.lesson==="resonance")for(const i of selected)result[i]=phrase.lesson;
   this.lesson=phrase.lesson;known.add(phrase.lesson);phrase.shown=true;return result;
  }
  // A lesson's other rows remain plain. It can enter combinations only in a
  // subsequent phrase, never elsewhere in its very first demonstration.
  if(phrase.lesson)return result;
  let section=c.section;
  if(section==="climax")section=(["cascade","maneuver","loot","tension","breather"] as const)[Math.floor(c.row/4)]??"breather";
  const pool=palettes[c.location][section].filter(type=>phrase.allowed.has(type));
  if(pool.length===0)return result;
  for(const [n,index]of selected.entries())result[index]=pool[(c.ordinal+(c.phase==="introduction"?0:n))%pool.length]??base;
  if(result.some(type=>type==="resonance"))for(const i of selected)result[i]="resonance";
  return result;
 }
}
