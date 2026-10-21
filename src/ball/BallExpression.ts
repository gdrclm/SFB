export type BallExpression = "neutral" | "focus" | "boost" | "break" | "coin" | "heal" | "slow" | "hurt" | "defeat";
const reactions: Record<BallExpression, { seconds: number; priority: number }> = {
  neutral: { seconds: 0, priority: 0 }, focus: { seconds: 0, priority: 0 },
  coin: { seconds: .28, priority: 1 }, break: { seconds: .3, priority: 2 },
  heal: { seconds: .7, priority: 3 }, slow: { seconds: .6, priority: 3 },
  boost: { seconds: .55, priority: 4 }, hurt: { seconds: .65, priority: 5 }, defeat: { seconds: Infinity, priority: 6 },
};

export class BallExpressionState {
  #current: BallExpression = "neutral";
  #remaining = 0;
  public get current(): BallExpression { return this.#current; }
  public react(event: BallExpression): boolean {
    if (this.#remaining > 0 && reactions[event].priority < reactions[this.#current].priority) return false;
    this.#current = event; this.#remaining = reactions[event].seconds;
    return true;
  }
  public update(delta: number, focused: boolean): void {
    this.#remaining = Math.max(0, this.#remaining - delta);
    if (this.#remaining <= 0) this.#current = focused ? "focus" : "neutral";
  }
}
