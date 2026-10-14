export class RunWallet {
  readonly #energyPerCoin: number;
  #coins = 0;
  #energy: number;

  public constructor(initialEnergy: number, energyPerCoin: number) {
    if (!Number.isFinite(initialEnergy) || initialEnergy < 0) {
      throw new RangeError("Initial energy must be finite and non-negative.");
    }
    if (!Number.isFinite(energyPerCoin) || energyPerCoin <= 0) {
      throw new RangeError("Energy per coin must be finite and positive.");
    }

    this.#energy = initialEnergy;
    this.#energyPerCoin = energyPerCoin;
  }

  public get coins(): number {
    return this.#coins;
  }

  public get energy(): number {
    return this.#energy;
  }

  public collectCoin(): void {
    this.#coins += 1;
    this.#energy += this.#energyPerCoin;
  }

  public addEnergy(amount: number): number {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new RangeError("Added energy must be finite and positive.");
    }

    this.#energy += amount;
    return this.#energy;
  }

  public spendEnergy(amount: number): boolean {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new RangeError("Energy cost must be finite and positive.");
    }
    if (this.#energy < amount) {
      return false;
    }

    this.#energy -= amount;
    return true;
  }

  public drainEnergy(amount: number): number {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new RangeError("Energy drain must be finite and positive.");
    }

    const drained = Math.min(this.#energy, amount);
    this.#energy = Math.max(0, this.#energy - drained);
    return drained;
  }
}
