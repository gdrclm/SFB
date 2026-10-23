import { calculateSpeedFeedback } from "./SpeedFeedbackCurve";

/** Edge-only wind, drawn without CSS masks, animated filters or a second RAF loop. */
export class WindCanvas {
  readonly #canvas = document.createElement("canvas");
  readonly #context: CanvasRenderingContext2D | null;
  readonly #beam = document.createElement("canvas");
  readonly #resize: ResizeObserver;
  readonly #motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  #feedback = calculateSpeedFeedback(0);
  #width = 0;
  #height = 0;
  #phase = 0;
  #burst = 0;
  #frozen = true;
  #dirty = true;

  public constructor(root: HTMLElement) {
    this.#canvas.className = "speed-wind-canvas";
    this.#canvas.setAttribute("aria-hidden", "true");
    this.#context = this.#canvas.getContext("2d", { alpha: true });
    this.#beam.width = 32;
    this.#beam.height = 256;
    const beam = this.#beam.getContext("2d");
    if (beam) {
      // Bake the luminous halo once. Each frame needs at most 24 small drawImage calls.
      const halo = beam.createLinearGradient(0, 0, 32, 0);
      halo.addColorStop(0, "rgba(0,100,255,0)");
      halo.addColorStop(.25, "rgba(0,130,255,.35)");
      halo.addColorStop(.44, "rgba(0,195,255,.95)");
      halo.addColorStop(.49, "#eaffff");
      halo.addColorStop(.51, "#ffffff");
      halo.addColorStop(.56, "rgba(0,195,255,.95)");
      halo.addColorStop(.75, "rgba(0,130,255,.35)");
      halo.addColorStop(1, "rgba(0,100,255,0)");
      beam.fillStyle = halo;
      beam.fillRect(0, 0, 32, 256);
      beam.globalCompositeOperation = "destination-in";
      const taper = beam.createLinearGradient(0, 0, 0, 256);
      taper.addColorStop(0, "transparent");
      taper.addColorStop(.2, "white");
      taper.addColorStop(.8, "white");
      taper.addColorStop(1, "transparent");
      beam.fillStyle = taper;
      beam.fillRect(0, 0, 32, 256);
    }
    if (this.#context && beam) {
      root.append(this.#canvas);
      root.classList.add("canvas-wind");
    }
    this.#resize = new ResizeObserver(() => { this.#resizeTo(root.clientWidth, root.clientHeight); });
    this.#resize.observe(root);
    this.#resizeTo(root.clientWidth, root.clientHeight);
  }

  #resizeTo(width: number, height: number): void {
    this.#width = width;
    this.#height = height;
    // Independent of device DPR: high density phones do not need a full-resolution FX buffer.
    const scale = Math.min(1, 1000 / Math.max(1, height));
    this.#canvas.width = Math.max(1, Math.round(width * scale));
    this.#canvas.height = Math.max(1, Math.round(height * scale));
    this.#context?.setTransform(scale, 0, 0, scale, 0, 0);
    this.#dirty = true;
  }

  public configure(speed: number, frozen: boolean): void {
    const next = calculateSpeedFeedback(speed);
    if (this.#feedback.power !== next.power) this.#dirty = true;
    this.#feedback = next;
    this.#frozen = frozen;
  }

  public boost(): void { this.#burst = .5; this.#dirty = true; }

  public draw(deltaSeconds: number): void {
    const ctx = this.#context;
    if (!ctx || this.#width === 0 || this.#height === 0) return;
    const reduced = this.#motion.matches;
    if ((this.#frozen || reduced && this.#burst === 0) && !this.#dirty) return;
    const dt = this.#frozen ? 0 : Math.min(.05, Math.max(0, deltaSeconds));
    this.#phase = (this.#phase + dt / this.#feedback.duration) % 1;
    this.#burst = Math.max(0, this.#burst - dt);
    this.#dirty = false;
    ctx.clearRect(0, 0, this.#width, this.#height);
    const { power, opacity, lanes, length, width } = this.#feedback;
    if (opacity === 0 && this.#burst === 0) return;
    const strength = Math.max(opacity, this.#burst * 1.6);
    const count = Math.max(lanes, this.#burst > 0 ? 5 : 0);
    const height = this.#height * (reduced ? Math.min(.18, length / 100) : length / 100);
    const breadth = width * 6;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, this.#width * .15, this.#height);
    ctx.rect(this.#width * .85, 0, this.#width * .15, this.#height);
    ctx.clip();
    // Keep the middle 70% free. Staggered phases put visible rays on screen immediately.
    for (let lane = 0; lane < 12; lane++) {
      const alpha = Math.min(1, Math.max(0, count - lane));
      if (alpha === 0) continue;
      for (let side = 0; side < 2; side++) {
        const phase = ((reduced ? .3 : this.#phase) + lane * .381966 + side * .27) % 1;
        const y = this.#height - phase * (this.#height + height);
        const edge = this.#width * (.018 + lane * .0105);
        const x = side === 0 ? edge : this.#width - edge;
        ctx.globalAlpha = alpha * strength * (reduced ? .55 : 1);
        ctx.drawImage(this.#beam, x - breadth / 2, y, breadth, height);
        // A compact bright head makes motion readable on light sky backgrounds too.
        if (!reduced && power > .25) {
          ctx.globalAlpha *= .65;
          ctx.drawImage(this.#beam, x - breadth, y + height * .6, breadth * 2, 14 + power * 22);
        }
      }
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  public dispose(): void {
    this.#resize.disconnect();
    this.#canvas.parentElement?.classList.remove("canvas-wind");
    this.#canvas.remove();
    this.#canvas.width = this.#beam.width = 1;
    this.#canvas.height = this.#beam.height = 1;
  }
}
