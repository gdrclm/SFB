/** Relative resistance controls both permanent momentum loss and contact duration. */
export function breakResistance(speed: number, strength: number): number {
  return Math.max(0, Math.min(1, strength / Math.max(.001, speed)));
}

export function speedAfterBreak(speed: number, strength: number, maximumLossFraction: number): number {
  const resistance = breakResistance(speed, strength);
  return Math.max(0, speed * (1 - maximumLossFraction * resistance * resistance));
}

export function breakImpactProfile(resistance: number): {
  hold: number; recovery: number; minimumTransmission: number; hitStop: number;
} {
  const ratio = Math.max(0, Math.min(1, resistance));
  return {
    hold: .005 + .055 * ratio * ratio,
    recovery: .035 + .085 * ratio * ratio,
    minimumTransmission: Math.max(0, 1 - ratio * 1.3),
    hitStop: ratio < .35 ? 0 : .006 + .028 * ratio * ratio,
  };
}
