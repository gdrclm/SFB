/** Location music stays within a musical range even at extreme fall speeds. */
export const MIN_MUSIC_TEMPO = .9;
export const MAX_MUSIC_TEMPO = 1.25;

function boundedTempo(value: number): number {
  return Number.isFinite(value)
    ? Math.max(MIN_MUSIC_TEMPO, Math.min(MAX_MUSIC_TEMPO, value))
    : MIN_MUSIC_TEMPO;
}

/** At the default baseline: 10 → .9, 30 → 1, 70 → 1.1, 150 → 1.2. */
export function musicTempoForSpeed(speed: number, baseSpeed = 10): number {
  const baseline = Number.isFinite(baseSpeed) && baseSpeed > 0 ? baseSpeed : 10;
  const ratio = Number.isFinite(speed) ? Math.max(1, speed / baseline) : 1;
  if (ratio === Infinity) return MAX_MUSIC_TEMPO;
  return boundedTempo(MIN_MUSIC_TEMPO + .1 * Math.log2((ratio + 1) / 2));
}

/** Smooth both acceleration and braking without changing response with FPS.
 * The caller should exclude paused time and cap any background-tab frame.
 */
export function advanceMusicTempo(current: number, target: number, seconds: number): number {
  const from = boundedTempo(current), to = boundedTempo(target);
  if (!Number.isFinite(seconds) || seconds <= 0) return from;
  return boundedTempo(from + (to - from) * (1 - Math.exp(-seconds * 3)));
}
