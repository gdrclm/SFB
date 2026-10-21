import type { AbstractEngine } from "@babylonjs/core/Engines/abstractEngine";

export type QualityTier = "low" | "medium" | "high";
export function initialQuality(memory?: number, cores?: number): QualityTier {
  if (memory !== undefined && memory <= 2 || cores !== undefined && cores <= 4) return "low";
  return memory !== undefined && memory <= 4 ? "medium" : "high";
}
export function renderScale(tier: QualityTier, width: number, height: number, dpr: number): number {
  const ratio = Math.min(Math.max(1, dpr), tier === "high" ? 1.5 : tier === "medium" ? 1.15 : .85);
  const pixels = tier === "high" ? 1_500_000 : tier === "medium" ? 900_000 : 500_000;
  return Math.max(1 / ratio, Math.sqrt(Math.max(1, width * height) / pixels));
}
/** Sustained frame times drive quality, never an isolated collection/loading stall. */
export class QualityBudget {
  public tier: QualityTier;
  #elapsed = 0; #frames = 0; #slowFrames = 0; #stable = 0; #warmup = 2;
  public constructor(tier: QualityTier) { this.tier = tier; }
  public observe(seconds: number, active: boolean): boolean {
    if (!active || !Number.isFinite(seconds) || seconds <= 0 || seconds > 1) {
      this.#elapsed = 0; this.#frames = 0; this.#slowFrames = 0; this.#stable = 0; return false;
    }
    if (this.#warmup > 0) { this.#warmup -= seconds; return false; }
    this.#elapsed += seconds; this.#frames++;
    if (seconds > .025) this.#slowFrames++;
    if (this.#elapsed < 2) return false;
    const average = this.#elapsed / this.#frames;
    this.#stable = average < .018 ? this.#stable + this.#elapsed : 0;
    const sustained = this.#slowFrames >= 3 && this.#slowFrames / this.#frames > .3;
    this.#elapsed = 0; this.#frames = 0; this.#slowFrames = 0;
    if (sustained && average > .025 && this.tier !== "low") {
      this.tier = this.tier === "high" ? "medium" : "low";
      this.#warmup = 3; return true;
    }
    if (this.#stable >= 20 && this.tier !== "high") {
      this.tier = this.tier === "low" ? "medium" : "high";
      this.#stable = 0; this.#warmup = 3; return true;
    }
    return false;
  }
}
const qualities = new WeakMap<AbstractEngine, AdaptiveQuality>();
export function getRenderQuality(engine: AbstractEngine): QualityTier { return qualities.get(engine)?.tier ?? "high"; }
export function deviceQuality(): QualityTier {
  return initialQuality((navigator as Navigator & { deviceMemory?: number }).deviceMemory, navigator.hardwareConcurrency);
}
export class AdaptiveQuality {
  readonly #engine: AbstractEngine;
  readonly #canvas: HTMLCanvasElement;
  readonly #budget: QualityBudget;
  public constructor(engine: AbstractEngine, canvas: HTMLCanvasElement) {
    this.#engine = engine; this.#canvas = canvas; this.#budget = new QualityBudget(deviceQuality());
    qualities.set(engine, this); this.resize();
  }
  public get tier(): QualityTier { return this.#budget.tier; }
  public update(seconds: number, active: boolean): void {
    if (this.#budget.observe(seconds, active)) this.resize();
  }
  public resize(): void {
    const bounds = this.#canvas.getBoundingClientRect();
    this.#engine.setHardwareScalingLevel(renderScale(this.tier, bounds.width, bounds.height, window.devicePixelRatio || 1));
    document.documentElement.dataset.quality = this.tier;
  }
}
