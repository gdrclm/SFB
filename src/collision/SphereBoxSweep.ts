import type { BallPosition } from "../ball/BallController";

/** Exact sphere/axis-aligned box sweep, including rounded edges and corners. */
export function sphereBoxFraction(start: BallPosition, end: BallPosition, center: BallPosition,
  half: BallPosition, radius: number): number | null {
  const axes = ["x", "y", "z"] as const;
  const boundaries = [0, 1];
  for (const axis of axes) {
    const delta = end[axis] - start[axis];
    if (delta === 0) continue;
    for (const sign of [-1, 1]) {
      const t = (center[axis] + half[axis] * sign - start[axis]) / delta;
      if (t > 0 && t < 1) boundaries.push(t);
    }
  }
  boundaries.sort((a, b) => a - b);
  for (let i = 0; i < boundaries.length - 1; i++) {
    const lo = boundaries[i] ?? 0, hi = boundaries[i + 1] ?? 1, mid = (lo + hi) / 2;
    let a = 0, b = 0, c = -radius * radius;
    for (const axis of axes) {
      const delta = end[axis] - start[axis], position = start[axis] + delta * mid;
      const min = center[axis] - half[axis], max = center[axis] + half[axis];
      if (position >= min && position <= max) continue;
      const offset = start[axis] - (position < min ? min : max);
      a += delta * delta; b += 2 * offset * delta; c += offset * offset;
    }
    if ((a * lo + b) * lo + c <= 1e-10) return lo;
    if (a === 0) continue;
    const discriminant = b * b - 4 * a * c;
    if (discriminant < 0) continue;
    const root = (-b - Math.sqrt(discriminant)) / (2 * a);
    if (root >= lo - 1e-10 && root <= hi + 1e-10) return Math.max(lo, Math.min(hi, root));
  }
  return null;
}
