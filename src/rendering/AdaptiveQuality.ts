import type { AbstractEngine } from "@babylonjs/core/Engines/abstractEngine";
import { getGraphicsSettings, type GraphicsSettings, type RenderQuality } from "./GraphicsSettings";

export type QualityTier = "low" | "medium" | "high";
const RENDER_BUDGETS = {
  low: { ratio: .85, pixels: 500_000 },
  medium: { ratio: 1.15, pixels: 900_000 },
  high: { ratio: 2, pixels: 3_000_000 },
  ultra: { ratio: 4, pixels: 8_500_000 },
} as const;
const AUTO_HIGH_BUDGET = { ratio: 1.5, pixels: 1_500_000 };
export function initialQuality(memory?: number, cores?: number): QualityTier {
  if (memory !== undefined && memory <= 2 || cores !== undefined && cores <= 4) return "low";
  return memory !== undefined && memory <= 4 ? "medium" : "high";
}
export function renderScale(tier: RenderQuality, width: number, height: number, dpr: number, manual = false): number {
  // Auto retains its conservative budget. Explicit High/Ultra allow a sharper
  // framebuffer without adding game objects or changing their collision range.
  const budget = tier === "high" && !manual ? AUTO_HIGH_BUDGET : RENDER_BUDGETS[tier];
  const ratio = Math.min(Math.max(1, Number.isFinite(dpr) ? dpr : 1), budget.ratio);
  return Math.max(1 / ratio, Math.sqrt(Math.max(1, width * height) / budget.pixels));
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
export function getRenderQuality(engine: AbstractEngine): RenderQuality { return qualities.get(engine)?.tier ?? "high"; }
export function deviceQuality(): QualityTier {
  return initialQuality((navigator as Navigator & { deviceMemory?: number }).deviceMemory, navigator.hardwareConcurrency);
}
export function initialRenderQuality(): RenderQuality {
  const mode = getGraphicsSettings().mode;
  return mode === "auto" ? deviceQuality() : mode;
}
export class AdaptiveQuality {
  readonly #engine: AbstractEngine;
  readonly #canvas: HTMLCanvasElement;
  #budget: QualityBudget;
  readonly #settings: GraphicsSettings;
  public constructor(engine: AbstractEngine, canvas: HTMLCanvasElement, settings = getGraphicsSettings()) {
    this.#engine = engine; this.#canvas = canvas; this.#settings = settings; this.#budget = new QualityBudget(deviceQuality());
    const unsubscribe = settings.subscribe(() => {
      this.#budget = new QualityBudget(deviceQuality());
      this.resize();
    });
    engine.onDisposeObservable.addOnce(() => { unsubscribe(); qualities.delete(engine); });
    qualities.set(engine, this); this.resize();
  }
  public get tier(): RenderQuality { return this.#settings.mode === "auto" ? this.#budget.tier : this.#settings.mode; }
  public get mode(): GraphicsSettings["mode"] { return this.#settings.mode; }
  public update(seconds: number, active: boolean): void {
    if (this.mode === "auto" && this.#budget.observe(seconds, active)) this.resize();
  }
  public resize(): void {
    const bounds = this.#canvas.getBoundingClientRect();
    this.#engine.setHardwareScalingLevel(renderScale(this.tier, bounds.width, bounds.height, window.devicePixelRatio || 1, this.mode !== "auto"));
    document.documentElement.dataset.quality = this.tier;
    document.documentElement.dataset.graphicsMode = this.mode;
  }
}
