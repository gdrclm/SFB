export type ApproachState = "breakable" | "close" | "hard" | "danger";
export function requiredSpeed(strength: number): number { return Math.ceil(strength); }
export function approachState(speed: number, strength: number): ApproachState {
  const threshold = requiredSpeed(strength);
  if (speed >= threshold) return "breakable";
  const ratio = speed / Math.max(threshold, Number.EPSILON);
  return ratio >= 0.85 ? "close" : ratio >= 2 / 3 ? "hard" : "danger";
}
interface LanePlatform {
  readonly isActive: boolean;
  readonly width: number;
  readonly mesh: { readonly position: { readonly x: number; readonly y: number } };
}
export function nearestInCurrentLane<T extends LanePlatform>(
  platforms: readonly T[], ball: { readonly x: number; readonly y: number }, radius: number,
): T | null {
  let nearest: T | null = null;
  for (const platform of platforms) {
    if (!platform.isActive || platform.mesh.position.y >= ball.y ||
      Math.abs(platform.mesh.position.x - ball.x) > platform.width / 2 + radius) continue;
    if (nearest === null || platform.mesh.position.y > nearest.mesh.position.y) nearest = platform;
  }
  return nearest;
}
