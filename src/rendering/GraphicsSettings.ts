export const GRAPHICS_MODES = ["auto", "low", "medium", "high", "ultra"] as const;
export type GraphicsMode = typeof GRAPHICS_MODES[number];
export type RenderQuality = Exclude<GraphicsMode, "auto">;
export const GRAPHICS_STORAGE_KEY = "speed-fall-ball.graphics-quality";
export const GRAPHICS_COMPATIBILITY_KEY = "speed-fall-ball.graphics-compatibility";

export function isGraphicsMode(value: unknown): value is GraphicsMode {
  return GRAPHICS_MODES.some(mode => mode === value);
}

/** A manual preset belongs to the device, independently of the run and shop. */
export class GraphicsSettings {
  #mode: GraphicsMode = "auto";
  #compatibility = false;
  readonly #listeners = new Set<() => void>();
  public constructor(private readonly storage: () => Pick<Storage, "getItem" | "setItem">) {
    try {
      const saved = storage().getItem(GRAPHICS_STORAGE_KEY);
      if (isGraphicsMode(saved)) this.#mode = saved;
      this.#compatibility = storage().getItem(GRAPHICS_COMPATIBILITY_KEY) === "true";
    } catch { /* Automatic quality works without storage. */ }
  }
  public get mode(): GraphicsMode { return this.#mode; }
  public get compatibility(): boolean { return this.#compatibility; }
  public setCompatibility(enabled: boolean): void {
    if (enabled === this.#compatibility) return;
    this.#compatibility = enabled;
    try { this.storage().setItem(GRAPHICS_COMPATIBILITY_KEY, String(enabled)); } catch { /* Keep the session choice. */ }
    for (const listener of this.#listeners) listener();
  }
  public set(mode: GraphicsMode): void {
    if (!isGraphicsMode(mode) || mode === this.#mode) return;
    this.#mode = mode;
    try { this.storage().setItem(GRAPHICS_STORAGE_KEY, mode); } catch { /* Keep the session choice. */ }
    for (const listener of this.#listeners) listener();
  }
  public subscribe(listener: () => void): () => void {
    this.#listeners.add(listener);
    return () => { this.#listeners.delete(listener); };
  }
}

let settings: GraphicsSettings | undefined;
export function getGraphicsSettings(): GraphicsSettings {
  settings ??= new GraphicsSettings(() => window.localStorage);
  return settings;
}
