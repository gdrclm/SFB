import type { PlatformEncounterTheme } from "./PlatformRoutePlanner";
import type { DepthLocation } from "../scene/DepthLocations";
import type { WorldPhase } from "../progression/WorldProgression";

export type PlatformMechanic = "moving" | "wind-left" | "wind-right" | "turret";

/** Prepare, demonstrate, leave room, then repeat. Short climax phrases only demonstrate. */
export function courseMechanic(theme: PlatformEncounterTheme, location: DepthLocation, phase: WorldPhase, row: number): PlatformMechanic | undefined {
  if ((row !== 2 && row !== 5) || (location === "sky" && phase === "introduction")) return undefined;
  if (theme === "trap") return "moving";
  if (theme === "rich-lane" && location !== "sky") return "wind-right";
  if (theme === "death-tunnel" && (phase !== "introduction" || location === "crystal")) return "turret";
  return undefined;
}
