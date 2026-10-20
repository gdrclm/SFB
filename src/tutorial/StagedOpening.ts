import type { PlatformKind } from "../config/gameConfig";

export const GUIDED_OPENING_KEY = "speed-fall-ball.guided-opening.v1";
export type GuideTip = "platform" | "coin" | "boost" | "fork" | "free" | "life" | "combo" | "vitality" | "time-slow" | "super-heavy";
export interface OpeningActions {
  spawn(kind: "platform" | "coin" | "boost" | "fork" | "practice"): void;
  explain(tip: GuideTip): void;
  random(): void;
  complete(): void;
}
const sequence = [
  { at: 0, kind: "platform" }, { at: 4, kind: "coin" },
  { at: 10, kind: "boost" }, { at: 18, kind: "fork" },
  { at: 22, kind: "practice" }, { at: 25, kind: "practice" }, { at: 28, kind: "practice" },
] as const;

export class StagedOpening {
  readonly #actions: OpeningActions;
  readonly #seen = new Set<GuideTip>();
  #elapsed = 0;
  #next = 0;
  #scripted = true;
  #skipped = false;

  public constructor(actions: OpeningActions) { this.#actions = actions; }
  public get isScripted(): boolean { return this.#scripted; }
  public get elapsed(): number { return this.#elapsed; }

  public fixedUpdate(delta: number): void {
    if (!this.#scripted) return;
    this.#elapsed += delta;
    let event = sequence[this.#next];
    while (event !== undefined && this.#elapsed + 1e-9 >= event.at) {
      this.#next++;
      if (event.kind === "fork") this.#seen.add("super-heavy");
      this.#actions.spawn(event.kind);
      if (event.kind !== "practice") {
        this.discover(event.kind);
        return;
      }
      event = sequence[this.#next];
    }
    if (this.#elapsed + 1e-9 >= 30) {
      this.#finish();
      this.discover("free");
    }
  }

  public discover(tip: GuideTip): void {
    if (this.#skipped || this.#seen.has(tip)) return;
    this.#seen.add(tip);
    this.#actions.explain(tip);
  }
  public platformAppeared(kind: PlatformKind): void {
    if (!this.#scripted && kind !== "standard") this.discover(kind);
  }
  public skip(): void { this.#skipped = true; this.#finish(); }
  #finish(): void {
    if (!this.#scripted) return;
    this.#scripted = false;
    this.#actions.random();
    this.#actions.complete();
  }
}

export function hasFinishedOpening(): boolean {
  try { return window.localStorage.getItem(GUIDED_OPENING_KEY) === "true"; }
  catch { return false; }
}
export function saveFinishedOpening(): void {
  try { window.localStorage.setItem(GUIDED_OPENING_KEY, "true"); }
  catch { /* Contextual help is usable without persistent storage. */ }
}
