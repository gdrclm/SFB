/** Each doubling remains visible through eight boosts, rather than saturating at 30–40. */
export function speedVisualPower(speed: number, baseline = 10): number {
  if (!Number.isFinite(speed) || baseline <= 0) return 0;
  return Math.max(0, Math.min(1, Math.log2(Math.max(1, speed / baseline)) / 5));
}
