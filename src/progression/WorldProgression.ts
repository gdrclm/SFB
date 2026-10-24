import type { DepthLocation } from "../scene/DepthLocations";

export type WorldPhase = "introduction" | "development" | "climax";
export const WORLD_STARTS = { sky: 0, crystal: 500, lava: 3000, abyss: 12000 } as const;
const phases: Record<DepthLocation, readonly [number, number]> = {
  sky: [160, 360], crystal: [1000, 2200], lava: [5000, 9500], abyss: [15000, 21000],
};
export interface WorldProgression {
  readonly location: DepthLocation;
  readonly phase: WorldPhase;
  readonly passageExtra: number;
  readonly routeScale: number;
  readonly spacingScale: number;
  readonly staggerScale: number;
  readonly safeStrengthRatio: number;
}
export function locationAtDepth(depth: number): DepthLocation {
  if (depth >= WORLD_STARTS.abyss) return "abyss";
  if (depth >= WORLD_STARTS.lava) return "lava";
  return depth >= WORLD_STARTS.crystal ? "crystal" : "sky";
}
export function worldProgression(depth: number): WorldProgression {
  const safeDepth = Number.isFinite(depth) ? Math.max(0, depth) : 0;
  const location = locationAtDepth(safeDepth);
  const [development, climax] = phases[location];
  const phase = safeDepth >= climax ? "climax" : safeDepth >= development ? "development" : "introduction";
  const tuning = phase === "introduction"
    ? { passageExtra: .65, routeScale: .65, spacingScale: 1.2, staggerScale: .65, safeStrengthRatio: .65 }
    : phase === "development"
      ? { passageExtra: .2, routeScale: 1, spacingScale: 1, staggerScale: 1, safeStrengthRatio: .82 }
      : { passageExtra: 0, routeScale: 1.1, spacingScale: .85, staggerScale: 1.1, safeStrengthRatio: .95 };
  return { location, phase, ...tuning };
}
