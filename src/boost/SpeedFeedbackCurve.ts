export function calculateSpeedFeedback(speed: number): { duration: number; opacity: number; power: number; length: number; width: number; lanes: number } {
  const safeSpeed = Number.isFinite(speed) ? Math.max(0, speed) : 0;
  const power = Math.max(0, Math.min(1, Math.log2(Math.max(1, safeSpeed / 10)) / 5));
  return {
    duration: 1.45 - 1.2 * power,
    opacity: power === 0 ? 0 : .08 + .86 * power ** .9,
    length: 8 + 48 * power ** 1.2,
    width: 1.4 + 4.2 * power,
    lanes: power === 0 ? 0 : 1 + 11 * power,
    power,
  };
}

