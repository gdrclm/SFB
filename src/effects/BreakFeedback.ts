import { breakResistance } from "../collision/BreakResistance";

export interface BreakFeedback {
  readonly power: number;
  readonly force: number;
  readonly perfect: boolean;
  readonly holdSeconds: number;
  readonly durationScale: number;
  readonly fragments: number;
  readonly spread: number;
}

/** Absolute speed controls the spectacle; a narrow, successful margin earns a rare impact hold. */
export function breakFeedback(speed: number, strength: number, perfectAvailable = true): BreakFeedback {
  const safeSpeed = Number.isFinite(speed) ? Math.max(0, speed) : 0;
  const power = Math.max(0, Math.min(1, Math.log2(Math.max(1, safeSpeed / 18)) / 3.5));
  const resistance = breakResistance(safeSpeed, strength);
  const perfect = perfectAvailable && safeSpeed >= 25 && strength <= safeSpeed && resistance >= .85;
  return {
    power, force: 1.2 + power * .4, perfect, holdSeconds: perfect ? .065 : 0,
    durationScale: 1 - .25 * power, fragments: power >= .4 ? 6 : 5,
    spread: 78 + power * 42,
  };
}
