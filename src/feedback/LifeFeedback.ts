interface FeedbackCamera {
  readonly position: { x: number; y: number };
  readonly orthoTop: number | null;
  readonly orthoBottom: number | null;
}
export const DEFEAT_SECONDS = 2;
const SHAKE_SECONDS = .95;
const SHAKE_HOLD_SECONDS = .14;
/** Real-time presentation only: it never moves the ball or advances gameplay. */
export class LifeFeedback {
  readonly #camera: FeedbackCamera;
  readonly #overlay: HTMLElement;
  readonly #reduced: boolean;
  #shakeAge = Infinity;
  #deathAge: number | null = null;
  #defeatFresh = false;
  #offsetX = 0;
  #offsetY = 0;
  public constructor(camera: FeedbackCamera, overlay: HTMLElement, reduced = false) {
    this.#camera = camera; this.#overlay = overlay; this.#reduced = reduced;
    overlay.hidden = false; overlay.dataset.critical = "false";
  }
  public get deathAge(): number | null { return this.#deathAge; }
  public get defeatReady(): boolean { return this.#deathAge !== null && this.#deathAge + 1e-8 >= DEFEAT_SECONDS; }
  public setLives(lives: number): void { this.#overlay.dataset.critical = String(lives === 1 || lives === 0); }
  public hit(): void { this.#shakeAge = 0; }
  public beginDefeat(): void { if (this.#deathAge === null) { this.#deathAge = 0; this.#defeatFresh = true; } }
  /** Remove the last render offset before camera follow and other hit effects. */
  public removeShake(): void {
    this.#camera.position.x -= this.#offsetX; this.#camera.position.y -= this.#offsetY;
    this.#offsetX = 0; this.#offsetY = 0;
  }
  public render(seconds: number, paused: boolean): void {
    this.removeShake();
    if (paused) return;
    const dt = Number.isFinite(seconds) ? Math.max(0, Math.min(.1, seconds)) : 0;
    if (this.#deathAge !== null) {
      // Start counting only after the first defeated pose is actually rendered.
      if (this.#defeatFresh) this.#defeatFresh = false;
      else this.#deathAge = Math.min(DEFEAT_SECONDS, this.#deathAge + (Number.isFinite(seconds) ? Math.max(0, seconds) : 0));
    }
    this.#shakeAge += dt;
    if (this.#shakeAge >= SHAKE_SECONDS || this.#reduced) return;
    const t = this.#shakeAge;
    const height = (this.#camera.orthoTop ?? 6) - (this.#camera.orthoBottom ?? -6);
    // Keep the impact at full strength before easing out. The old immediate
    // quadratic decay made most of its shake almost invisible on a phone.
    const fade = Math.max(0, Math.min(1, (t - SHAKE_HOLD_SECONDS) / (SHAKE_SECONDS - SHAKE_HOLD_SECONDS)));
    const envelope = 1 - fade * fade * (3 - 2 * fade);
    const amplitude = height * .12 * envelope;
    // Slower, distinct kicks remain legible at both 30 and 60 FPS.
    this.#offsetX = (Math.sin(t * 43 + 1.2) * .7 + Math.sin(t * 73) * .3) * amplitude;
    this.#offsetY = (Math.sin(t * 57 + .4) * .65 + Math.sin(t * 89) * .35) * amplitude * .85;
    this.#camera.position.x += this.#offsetX; this.#camera.position.y += this.#offsetY;
  }
  public hide(): void { this.removeShake(); this.#overlay.hidden = true; }
  public dispose(): void { this.hide(); this.#overlay.dataset.critical = "false"; }
}
