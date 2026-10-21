import type { GameConfig } from "../config/gameConfig";
export type PowerKind = "annihilation" | "plasma";
interface Point { readonly x: number; readonly y: number }
interface PowerBall { readonly position: Point; fallSpeed: number }
export const ANNIHILATION_RADIUS = 200;
export const PLASMA_SECONDS = 30;
export class PowerUpController {
  readonly #config: GameConfig["powers"];
  readonly #ball: PowerBall;
  readonly #canActivate: () => boolean;
  readonly #activate: (kind: PowerKind) => void;
  readonly #miniSweep: () => void;
  #annihilationCharges = 4;
  readonly #sweep: () => void;
  readonly #used = new Set<PowerKind>();
  #zone: Point | null = null;
  #plasmaRemaining = 0;
  #plasmaElapsed = 0;
  #plasmaStart = 0;
  #plasmaTarget = 0;
  public constructor(config: GameConfig["powers"], ball: PowerBall, canActivate: () => boolean,
    activate: (kind: PowerKind) => void, sweep: () => void, miniSweep: () => void = () => {}) {
    this.#config = config; this.#ball = ball; this.#canActivate = canActivate;
    this.#activate = activate; this.#sweep = sweep; this.#miniSweep = miniSweep;
  }
  public get plasmaRemaining(): number { return this.#plasmaRemaining; }
  public get invulnerable(): boolean { return this.#plasmaRemaining > 0; }
  public get zone(): Point | null { return this.#zone; }
  public unlocked(kind: PowerKind): boolean { return this.#config[kind]; }
  public get annihilationCharges(): number { return this.#config.annihilation ? this.#annihilationCharges : 0; }
  public available(kind: PowerKind): boolean {
    return this.unlocked(kind) && (kind === "annihilation" ? this.#annihilationCharges > 0 : !this.#used.has(kind));
  }
  public tryMiniAnnihilation(): boolean {
    if (!this.available("annihilation") || !this.#canActivate()) return false;
    this.#annihilationCharges -= 1;
    this.#activate("annihilation"); this.#miniSweep();
    return true;
  }
  public covers(point: Point): boolean {
    return this.#zone !== null && Math.hypot(point.x - this.#zone.x, point.y - this.#zone.y) <= ANNIHILATION_RADIUS;
  }
  public tryActivate(kind: PowerKind): boolean {
    if (!this.available(kind) || !this.#canActivate()) return false;
    if (kind === "annihilation" && this.#annihilationCharges < 4) return false;
    this.#used.add(kind);
    if (kind === "annihilation") { this.#annihilationCharges = 0; this.#zone = { x: this.#ball.position.x, y: this.#ball.position.y }; }
    else {
      this.#plasmaRemaining = PLASMA_SECONDS; this.#plasmaElapsed = 0;
      this.#plasmaStart = this.#ball.fallSpeed;
      this.#plasmaTarget = Math.max(this.#plasmaStart, Math.min(600, Math.max(180, this.#plasmaStart * 3)));
    }
    this.#activate(kind);
    if (kind === "annihilation") this.#sweep();
    return true;
  }
  public fixedUpdate(delta: number, realSeconds = delta): void {
    if (this.#zone !== null) {
      if (!this.covers(this.#ball.position)) this.#zone = null;
      else this.#sweep(); // Clears streamed scenery inside the same 200 m sphere without allocating a huge world.
    }
    if (this.#plasmaRemaining <= 0 || realSeconds <= 0) return;
    this.#plasmaElapsed += realSeconds;
    this.#plasmaRemaining = Math.max(0, this.#plasmaRemaining - realSeconds);
    if (this.#plasmaRemaining < 1e-8) this.#plasmaRemaining = 0;
    const t = Math.min(1, this.#plasmaElapsed / .9);
    this.#ball.fallSpeed = Math.max(this.#ball.fallSpeed, this.#plasmaStart + (this.#plasmaTarget - this.#plasmaStart) * t * t * (3 - 2 * t));
  }
}
