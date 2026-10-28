/** Keep the familiar opening; blend assistance in between 2x and 6x fall speed. */
function steeringProgress(fallSpeed: number, startFallSpeed: number): number {
  if (!Number.isFinite(fallSpeed) || !Number.isFinite(startFallSpeed) || startFallSpeed <= 0) return 0;
  const t = Math.max(0, Math.min(1, (fallSpeed / startFallSpeed - 2) / 4));
  return t * t * (3 - 2 * t);
}

/** Wide screens must not amplify the starting movement before the speed gate. */
export function steeringWidthScale(widthRatio: number, fallSpeed: number, startFallSpeed: number): number {
  const expansion = Number.isFinite(widthRatio) ? Math.max(1, widthRatio) : 1;
  return 1 + .75 * (expansion - 1) * steeringProgress(fallSpeed, startFallSpeed);
}

/** Near-target damping is fully active at 45 (default baseline), not more gain. */
export function steeringPrecisionBlend(fallSpeed: number, startFallSpeed: number): number {
  if (!Number.isFinite(fallSpeed) || startFallSpeed <= 0) return 0;
  const t = Math.max(0, Math.min(1, fallSpeed / startFallSpeed - 3.5));
  return t * t * (3 - 2 * t);
}
