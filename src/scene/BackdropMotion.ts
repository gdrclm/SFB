/** All motion is driven by camera displacement, so pause stops it and bounce reverses it. */
export const BACKDROP_TRANSITION_SECONDS = 2;
export function pageProgress(elapsed: number): number {
  const t = Math.max(0, Math.min(1, elapsed / BACKDROP_TRANSITION_SECONDS));
  return t * t * t * (t * (t * 6 - 15) + 10);
}
export function sceneryY(anchor: number, cameraTravel: number, rate: number): number {
  return ((anchor + cameraTravel * rate + 21) % 42 + 42) % 42 - 21;
}
export function sceneryRate(index: number): number {
  // Stagger depth on both sides: neighbouring cards never move as a flat wall.
  return [.10, .43, .18, .82, .58, .14, .68, .27, 1.05, .36][index % 10] ?? .1;
}
