/** Explain BOOST once during an explicitly enabled lesson after repeated mistakes. */
export class BoostCoach {
  #failures = 0;
  #shown = false;
  #remaining = 0;
  public get visible(): boolean { return this.#remaining > 0; }
  public failedImpact(): void { this.#failures++; }
  public boosted(): void { this.#failures = 0; this.dismiss(); }
  public dismiss(): void { this.#remaining = 0; }
  public fixedUpdate(delta: number, canExplain: boolean): void {
    if (!canExplain) { this.dismiss(); return; }
    this.#remaining = Math.max(0, this.#remaining - delta);
    if (!this.#shown && this.#failures >= 2) {
      this.#shown = true;
      this.#remaining = 10;
    }
  }
}
