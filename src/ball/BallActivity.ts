export type BallActivityMode = "drift" | "paddle" | "dive" | "surge";
/** Distinct poses and cadence, independent of physics and camera movement. */
export function ballActivity(speed: number, baseline = 10): { mode: BallActivityMode; energy: number; cadence: number; pulse: number } {
  const ratio = Number.isFinite(speed) ? Math.max(1, speed / Math.max(1, baseline)) : 1;
  const energy = Math.min(1, Math.log2(ratio) / 4);
  return { mode: ratio < 2 ? "drift" : ratio < 4 ? "paddle" : ratio < 8 ? "dive" : "surge",
    energy, cadence: .7 + energy * 5.8, pulse: .06 * Math.max(0, Math.min(1, (ratio - 4) / 12)) };
}
