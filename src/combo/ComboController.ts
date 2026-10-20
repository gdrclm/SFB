export const COMBO_THRESHOLDS = [0, 3, 6, 10, 15] as const;

export function speedMultiplier(speed: number): number {
  return speed >= 55 ? 2 : speed >= 35 ? 1.5 : speed >= 20 ? 1.25 : 1;
}

export function assessRisk(speed: number, strength: number): "blocked" | "edge" | "safe" {
  if (speed < strength) return "blocked";
  return strength / Math.max(speed, Number.EPSILON) >= 0.85 ? "edge" : "safe";
}

export function comboMultiplier(count: number): number {
  return COMBO_THRESHOLDS.filter((threshold) => count >= threshold).length;
}

export interface ComboHit {
  readonly count: number;
  readonly multiplier: number;
  readonly speedMultiplier: number;
  readonly risky: boolean;
  readonly points: number;
  readonly tierIncreased: boolean;
}

export class ComboController {
  #count = 0;
  #best = 0;
  #bonus = 0;

  public get count(): number { return this.#count; }
  public get best(): number { return this.#best; }
  public get bonus(): number { return this.#bonus; }
  public get multiplier(): number { return comboMultiplier(this.#count); }
  public get nextThreshold(): number | null {
    return COMBO_THRESHOLDS.find((threshold) => threshold > this.#count) ?? null;
  }
  public get progress(): number {
    const next = this.nextThreshold;
    if (next === null) return 1;
    const previous = COMBO_THRESHOLDS[this.multiplier - 1] ?? 0;
    return (this.#count - previous) / (next - previous);
  }

  public hit(speed: number, strength: number): ComboHit {
    if (!Number.isFinite(speed) || !Number.isFinite(strength) || speed <= 0 || strength < 0 || speed < strength) {
      throw new RangeError("Combo requires a successful hit with finite speed and strength.");
    }
    const previousMultiplier = this.multiplier;
    this.#count++;
    this.#best = Math.max(this.#best, this.#count);
    const risky = assessRisk(speed, strength) === "edge";
    const speedBonus = speedMultiplier(speed);
    const points = Math.floor(25 * this.multiplier * speedBonus * (risky ? 1.5 : 1));
    this.#bonus += points - 25;
    return { count: this.#count, multiplier: this.multiplier, speedMultiplier: speedBonus,
      risky, points, tierIncreased: this.multiplier > previousMultiplier };
  }

  public miss(): number {
    const lost = this.#count;
    this.#count = 0;
    return lost;
  }
}
