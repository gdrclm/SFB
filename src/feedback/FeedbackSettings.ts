export type FeedbackSetting = "music" | "effects" | "vibration";
export class FeedbackSettings {
  readonly #storage: () => Pick<Storage, "getItem" | "setItem">;
  readonly #values: Record<FeedbackSetting, boolean> = { music: true, effects: true, vibration: true };
  readonly #listeners = new Set<() => void>();
  public constructor(storage: () => Pick<Storage, "getItem" | "setItem">) {
    this.#storage = storage;
    for (const name of ["music", "effects", "vibration"] as const) {
      try {
        const old = name === "vibration" ? null : storage().getItem("speed-fall-ball.sound-enabled");
        const raw = storage().getItem(`speed-fall-ball.${name}-enabled`) ?? old;
        this.#values[name] = raw === null || raw === "true";
      } catch { /* Keep session defaults when persistence is blocked. */ }
    }
  }
  public get(name: FeedbackSetting): boolean { return this.#values[name]; }
  public set(name: FeedbackSetting, enabled: boolean): void {
    this.#values[name] = enabled;
    try { this.#storage().setItem(`speed-fall-ball.${name}-enabled`, String(enabled)); } catch { /* Session setting still works. */ }
    for (const listener of this.#listeners) listener();
  }
  public subscribe(listener: () => void): () => void { this.#listeners.add(listener); return () => { this.#listeners.delete(listener); }; }
}
