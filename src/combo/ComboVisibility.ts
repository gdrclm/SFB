/** Two seconds of active real time, refreshed by each hit; pausing stops fixed updates. */
export class ComboVisibility {
  #remaining = 0;
  public get visible(): boolean { return this.#remaining > 0; }
  public show(): void { this.#remaining = 2; }
  public advance(realDeltaSeconds: number): void {
    this.#remaining = Math.max(0, this.#remaining - realDeltaSeconds);
    if (this.#remaining < 1e-9) this.#remaining = 0;
  }
  public reset(): void { this.#remaining = 0; }
}
