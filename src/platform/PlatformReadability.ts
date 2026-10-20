export type ApproachState = "breakable" | "boost" | "neutral" | "danger";
export function requiredSpeed(strength: number): number { return Math.ceil(strength); }
/** Red is an imminent collision warning, never a prediction about a distant lane. */
export function approachState(speed: number, strength: number, boostAvailable = true, boostMultiplier = 1.5, secondsToImpact = Infinity): ApproachState {
  const threshold = requiredSpeed(strength);
  if (speed >= threshold) return "breakable";
  if (boostAvailable && speed * boostMultiplier >= threshold) return "boost";
  return secondsToImpact <= .7 ? "danger" : "neutral";
}
interface LanePlatform {
  readonly isActive: boolean;
  readonly width: number;
  readonly strength?: number;
  readonly mesh: { readonly position: { readonly x: number; readonly y: number } };
}
export function nearestInCurrentLane<T extends LanePlatform>(
  platforms: readonly T[], ball: { readonly x: number; readonly y: number }, radius: number,
): T | null {
  let nearest: T | null = null;
  for (const platform of platforms) {
    if (!platform.isActive || platform.mesh.position.y >= ball.y ||
      Math.abs(platform.mesh.position.x - ball.x) > platform.width / 2 + radius) continue;
    if (nearest === null || platform.mesh.position.y > nearest.mesh.position.y ||
      Math.abs(platform.mesh.position.y - nearest.mesh.position.y) < 1e-6 && (platform.strength ?? 0) > (nearest.strength ?? 0)) nearest = platform;
  }
  return nearest;
}

/** Breakable and neutral surfaces communicate through material and contour alone. */
export function approachSymbol(state: ApproachState | null): string {
  return state === "boost" ? "ϟ" : state === "danger" ? "!" : "";
}
