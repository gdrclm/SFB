/** Monotonic active wall time, independent of the physics catch-up budget. */
export class ActiveRunClock {
  #last = 0;
  #active = false;
  #seconds = 0;
  public get seconds(): number { return this.#seconds; }
  public reset(now: number): void { this.#last = now; this.#seconds = 0; this.#active = false; }
  public setActive(active: boolean, now: number): void {
    if (!Number.isFinite(now)) return;
    const next = Math.max(this.#last, now);
    if (this.#active) this.#seconds += (next - this.#last) / 1000;
    this.#last = next; this.#active = active;
  }
}
