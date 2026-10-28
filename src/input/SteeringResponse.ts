/** Faster falls need quicker corrections, with a bounded gain for fine control. */
export function steeringSpeedScale(fallSpeed: number, startFallSpeed: number): number {
  if (!Number.isFinite(fallSpeed) || !Number.isFinite(startFallSpeed) || startFallSpeed <= 0) return 1;
  return Math.min(3, Math.sqrt(Math.max(1, fallSpeed / startFallSpeed)));
}
