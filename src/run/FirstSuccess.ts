/** A life loss resets progress, even if a later platform restores that life. */
export class FirstSuccess {
  public static readonly target = 5;
  public static readonly reward = 25;
  #count = 0;
  #completed = false;
  public get count(): number { return this.#count; }
  public get completed(): boolean { return this.#completed; }
  public hit(): boolean {
    if (this.#completed) return false;
    this.#count++;
    this.#completed = this.#count >= FirstSuccess.target;
    return this.#completed;
  }
  public loseLife(): void { if (!this.#completed) this.#count = 0; }
}
