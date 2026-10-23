import type { PlatformKind } from "../config/gameConfig";

export const GUIDED_OPENING_KEY = "speed-fall-ball.guided-opening.v1";
export type GuideTip = "platform" | "coin" | "boost" | "fork" | "free" | "life" | "combo" | "vitality" | "time-slow" | "super-heavy" | "annihilation" | "ability" | "abilities";
export interface OpeningActions {
  spawn(kind: "platform" | "coin" | "boost" | "fork" | "practice" | "vitality" | "time-slow" | "ability" | "ability-demo" | "abilities" | "annihilation" | "annihilation-demo"): void;
  explain(tip: GuideTip): void;
  random(): void;
  complete(): void;
  readyForBoost?(): boolean;
}
const sequence = [
  { at: 0, kind: "platform" }, { at: 2, kind: "practice" }, { at: 4, kind: "coin" },
  { at: 5, kind: "practice" }, { at: 7, kind: "practice" }, { at: 9, kind: "practice" }, { at: 11, kind: "practice" },
  { at: 16, kind: "boost" }, { at: 23, kind: "fork" },
  { at: 26, kind: "practice" }, { at: 29, kind: "vitality" },
  { at: 35, kind: "time-slow" }, { at: 41, kind: "ability" },
  { at: 44, kind: "ability-demo" }, { at: 47, kind: "abilities" }, { at: 52, kind: "annihilation" },
  { at: 54, kind: "annihilation-demo" },
] as const;

export class StagedOpening {
  readonly #actions: OpeningActions;
  readonly #seen = new Set<GuideTip>();
  #elapsed = 0;
  #next = 0;
  #scripted = true;
  #skipped = false;
  #delay = 0;
  #lastPractice = -Infinity;

  public constructor(actions: OpeningActions) { this.#actions = actions; }
  public get isScripted(): boolean { return this.#scripted; }
  public get wasSkipped(): boolean { return this.#skipped; }
  public get elapsed(): number { return this.#elapsed; }

  public fixedUpdate(delta: number): void {
    if (!this.#scripted) return;
    this.#elapsed += delta;
    let event = sequence[this.#next];
    while (event !== undefined && this.#elapsed - this.#delay + 1e-9 >= event.at) {
      if (event.kind === "boost" && this.#actions.readyForBoost?.() === false) {
        this.#delay = this.#elapsed - event.at;
        if (this.#elapsed - this.#lastPractice >= 2) {
          this.#lastPractice = this.#elapsed;
          this.#actions.spawn("practice");
        }
        return;
      }
      this.#next++;
      if (event.kind === "fork") this.#seen.add("super-heavy");
      this.#actions.spawn(event.kind);
      if (event.kind !== "practice" && event.kind !== "annihilation-demo" && event.kind !== "ability-demo") {
        this.discover(event.kind);
        return;
      }
      event = sequence[this.#next];
    }
    if (this.#elapsed - this.#delay + 1e-9 >= 58) this.#finish();
  }

  public discover(tip: GuideTip): void {
    if (this.#skipped || !this.#scripted || this.#seen.has(tip)) return;
    this.#seen.add(tip);
    this.#actions.explain(tip);
  }
  public platformAppeared(kind: PlatformKind): void {
    if (this.#scripted && kind !== "standard") this.discover(kind);
  }
  public skip(): void { this.#skipped = true; this.#finish(); }
  #finish(): void {
    if (!this.#scripted) return;
    this.#scripted = false;
    if (this.#skipped) this.#actions.random();
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
