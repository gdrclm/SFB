import type { PlatformKind } from "../config/gameConfig";
import type { DepthLocation } from "../scene/DepthLocations";
import type { PlatformMechanic } from "./PlatformMechanic";
export type SkyPlatformAppearance = "cloud" | "bubble";
/** Half of ordinary sky surfaces retain their islands; the other half alternate
 * soft clouds and water bubbles. This never changes strength or geometry. */
export function skyPlatformAppearance(location: DepthLocation, kind: PlatformKind, mechanic: PlatformMechanic | undefined, ordinal: number): SkyPlatformAppearance | undefined {
  if(location!=="sky"||kind!=="standard"||mechanic!==undefined)return undefined;
  const index=((Math.floor(ordinal)%4)+4)%4;
  return index===1?"cloud":index===2?"bubble":undefined;
}
