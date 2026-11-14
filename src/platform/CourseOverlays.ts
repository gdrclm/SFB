import type { WorldPhase } from "../progression/WorldProgression";
import type { DepthLocation } from "../scene/DepthLocations";
import type { CourseSection } from "./CourseSections";

export type CourseOverlay="moving-gap"|"turret-volley";

/** A new decision lands on the same authored beats as the mechanic lessons.
 * Run-up and recovery stay clean; a climax borrows the vocabulary of its parts. */
export function courseOverlay(section:CourseSection,location:DepthLocation,phase:WorldPhase,row:number):CourseOverlay|undefined{
 if(location==="sky"||section==="run-up"||section==="breather")return undefined;
 if(section==="climax")return row===6?"moving-gap":row===14?"turret-volley":undefined;
 if(section==="maneuver"&&row===5)return "moving-gap";
 if(section==="tension"&&row===5)return "turret-volley";
 if(phase==="introduction")return undefined;
 if(section==="loot"&&row===5)return "moving-gap";
 if(section==="cascade"){
  if(row===2)return "moving-gap";
  if(row===5)return "turret-volley";
 }
 return undefined;
}
