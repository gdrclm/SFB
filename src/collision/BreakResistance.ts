/** Relative resistance controls both permanent momentum loss and contact duration. */
export function breakResistance(speed: number, strength: number): number {
  return Math.max(0, Math.min(1, strength / Math.max(.001, speed)));
}

export function speedAfterBreak(speed: number, strength: number, maximumLossFraction: number, maximumLoss: number, flow=0): number {
  const resistance = breakResistance(speed, strength);
  return Math.max(0, speed - Math.min(maximumLoss, speed * maximumLossFraction * resistance * resistance)*(1-Math.max(0,Math.min(1,flow))*.85));
}

export function breakImpactProfile(resistance: number): {
  hold: number; recovery: number; minimumTransmission: number;
} {
  const ratio = Math.max(0, Math.min(1, resistance));
  return {
    hold: .004 + .008 * ratio * ratio,
    recovery: .025 + .035 * ratio * ratio,
    minimumTransmission: 1 - .18 * ratio * ratio,
  };
}
