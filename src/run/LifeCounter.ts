export class LifeCounter {
  readonly #maximumLives: number;
  #remainingLives: number;

  public constructor(initialLives: number) {
    if (!Number.isInteger(initialLives) || initialLives <= 0) {
      throw new RangeError("Initial lives must be a positive integer.");
    }

    this.#maximumLives = initialLives;
    this.#remainingLives = initialLives;
  }

  public get remainingLives(): number {
    return this.#remainingLives;
  }

  public get maximumLives(): number {
    return this.#maximumLives;
  }

  public loseLife(): boolean {
    if (this.#remainingLives <= 0) {
      return false;
    }

    this.#remainingLives -= 1;
    return true;
  }

  public restoreLives(amount: number): number {
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new RangeError("Restored lives must be a positive integer.");
    }

    const previousLives = this.#remainingLives;
    this.#remainingLives = Math.min(
      this.#maximumLives,
      this.#remainingLives + amount,
    );
    return this.#remainingLives - previousLives;
  }
}
