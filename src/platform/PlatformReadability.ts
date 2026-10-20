export type ApproachState = "breakable" | "close" | "hard" | "danger" | "unavailable";
export function requiredSpeed(strength: number): number { return Math.ceil(strength); }
export function approachState(speed: number, strength: number, boostAvailable = true, boostMultiplier = 1.5): ApproachState {
  const threshold = requiredSpeed(strength);
  if (speed >= threshold) return "breakable";
  if (speed * boostMultiplier < threshold) return "danger";
  if (!boostAvailable) return "unavailable";
  const ratio = speed / Math.max(threshold, Number.EPSILON);
  return ratio >= 0.85 ? "close" : "hard";
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

/** These symbols express the current lane only; amber means one BOOST can suffice. */
export function approachSymbol(state: ApproachState | null): string {
  return state === "breakable" ? "✓" : state === "danger" ? "✕" : state === null ? "" : state === "unavailable" ? "◷" : "ϟ";
}
