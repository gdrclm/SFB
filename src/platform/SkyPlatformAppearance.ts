import type { PlatformKind } from "../config/gameConfig";
import type { DepthLocation } from "../scene/DepthLocations";
import type { PlatformMechanic } from "./PlatformMechanic";
export type SkyPlatformAppearance = "cloud" | "bubble";
/** Artwork fallback for initial/staged platforms; surface gameplay is handled by SurfaceInteractions. */
export function skyPlatformAppearance(location: DepthLocation, kind: PlatformKind, mechanic: PlatformMechanic | undefined, ordinal: number): SkyPlatformAppearance | undefined {
  if(location!=="sky"||kind!=="standard"||mechanic!==undefined)return undefined;
  const index=((Math.floor(ordinal)%4)+4)%4;
  return index===1?"cloud":index===2?"bubble":undefined;
}
