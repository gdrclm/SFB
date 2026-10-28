import type { PlatformEncounterTheme } from "./PlatformRoutePlanner";
import type { DepthLocation } from "../scene/DepthLocations";
import type { WorldPhase } from "../progression/WorldProgression";

export type PlatformMechanic = "moving" | "wind-left" | "wind-right" | "turret";

/** Introduce one mechanic in the middle pair of an authored phrase. */
export function courseMechanic(theme: PlatformEncounterTheme, location: DepthLocation, phase: WorldPhase, row: number): PlatformMechanic | undefined {
  if (row < 2 || row > 3 || (location === "sky" && phase === "introduction")) return undefined;
  if (theme === "trap") return "moving";
  if (theme === "rich-lane" && location !== "sky") return "wind-right";
  if (theme === "death-tunnel" && phase !== "introduction") return "turret";
  return undefined;
}
