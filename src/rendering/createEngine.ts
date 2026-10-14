import { Engine } from "@babylonjs/core/Engines/engine";
import type { AbstractEngine } from "@babylonjs/core/Engines/abstractEngine";
import { WebGPUEngine } from "@babylonjs/core/Engines/webgpuEngine";

export type RendererKind = "webgl2" | "webgpu";

export interface EngineResult {
  readonly engine: AbstractEngine;
  readonly renderer: RendererKind;
}

function requestsWebGpu(): boolean {
  return new URLSearchParams(window.location.search).get("renderer") === "webgpu";
}

async function tryCreateWebGpuEngine(canvas: HTMLCanvasElement): Promise<WebGPUEngine | null> {
  if (!requestsWebGpu() || !(await WebGPUEngine.IsSupportedAsync)) {
    return null;
  }

  const engine = new WebGPUEngine(canvas, {
    adaptToDeviceRatio: true,
    antialias: true,
  });
  await engine.initAsync();
  return engine;
}

export async function createEngine(canvas: HTMLCanvasElement): Promise<EngineResult> {
  const webGpuEngine = await tryCreateWebGpuEngine(canvas);
  if (webGpuEngine !== null) {
    return { engine: webGpuEngine, renderer: "webgpu" };
  }

  const engine = new Engine(
    canvas,
    true,
    {
      disableWebGL2Support: false,
      preserveDrawingBuffer: false,
      stencil: true,
    },
    true,
  );

  if (engine.webGLVersion !== 2) {
    engine.dispose();
    throw new Error("Babylon.js could not initialize a WebGL2 context.");
  }

  return { engine, renderer: "webgl2" };
}
