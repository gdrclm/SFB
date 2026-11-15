import { AdaptiveQuality, initialRenderQuality } from "./AdaptiveQuality";
import { Engine } from "@babylonjs/core/Engines/engine";
import type { AbstractEngine } from "@babylonjs/core/Engines/abstractEngine";
import { WebGPUEngine } from "@babylonjs/core/Engines/webgpuEngine";
import { getGraphicsSettings } from "./GraphicsSettings";
import { mobileGraphicsDevice, watchGraphicsContext } from "./GraphicsContext";

export type RendererKind = "webgl1" | "webgl2" | "webgpu";

export interface EngineResult {
  readonly engine: AbstractEngine;
  readonly renderer: RendererKind;
  readonly quality: AdaptiveQuality;
}

function requestsWebGpu(): boolean {
  return new URLSearchParams(window.location.search).get("renderer") === "webgpu";
}
function requestsAntialias(): boolean {
  if (mobileGraphicsDevice() || getGraphicsSettings().compatibility) return false;
  const quality = initialRenderQuality();
  return quality === "high" || quality === "ultra";
}

async function tryCreateWebGpuEngine(canvas: HTMLCanvasElement): Promise<WebGPUEngine | null> {
  if (!requestsWebGpu() || !(await WebGPUEngine.IsSupportedAsync)) {
    return null;
  }

  const engine = new WebGPUEngine(canvas, {
    adaptToDeviceRatio: false,
    antialias: requestsAntialias(),
  });
  try { await engine.initAsync(); return engine; }
  catch { engine.dispose(); return null; }
}

export async function createEngine(canvas: HTMLCanvasElement): Promise<EngineResult> {
  const compatibility = getGraphicsSettings().compatibility || new URLSearchParams(window.location.search).get("renderer") === "webgl1";
  const webGpuEngine = compatibility ? null : await tryCreateWebGpuEngine(canvas);
  if (webGpuEngine !== null) {
    watchGraphicsContext(webGpuEngine, canvas);
    return { engine: webGpuEngine, renderer: "webgpu", quality: new AdaptiveQuality(webGpuEngine, canvas) };
  }

  let engine: Engine;
  const options = {
    disableWebGL2Support: compatibility,
    antialias: !compatibility && requestsAntialias(),
    preserveDrawingBuffer: false,
    alpha: false,
    stencil: false,
    powerPreference: mobileGraphicsDevice() ? "default" : "high-performance",
  } as const;
  try {
    // Check on the actual canvas before constructing Babylon: its constructor
    // registers listeners/engine instances even when context creation then fails.
    const kinds = compatibility ? ["webgl", "experimental-webgl"] : ["webgl2", "experimental-webgl2", "webgl", "experimental-webgl"];
    let context: WebGLRenderingContext | null = null;
    for (const kind of kinds) {
      try { context = canvas.getContext(kind, options) as WebGLRenderingContext | null; } catch { /* Try the next supported API. */ }
      if (context) break;
    }
    if (!context || context.isContextLost()) throw new Error("Graphics context unavailable");
    engine = new Engine(
      canvas,
      options.antialias,
      options,
      false,
    );
  } catch (cause: unknown) {
    throw new Error("Браузер не смог запустить графику. Включи совместимость в настройках и перезапусти игру. Если ошибка остаётся, полностью закрой браузер и открой снова.", { cause });
  }
  const compatible = compatibility || engine.webGLVersion === 1;
  if (compatible) {
    engine.disableVertexArrayObjects = true;
    getGraphicsSettings().setCompatibility(true);
  }
  watchGraphicsContext(engine, canvas);
  return { engine, renderer: engine.webGLVersion === 1 ? "webgl1" : "webgl2", quality: new AdaptiveQuality(engine, canvas, getGraphicsSettings(), compatible) };
}
