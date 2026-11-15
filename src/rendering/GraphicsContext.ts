import type { AbstractEngine } from "@babylonjs/core/Engines/abstractEngine";
import type { ThinEngine } from "@babylonjs/core/Engines/thinEngine";
import { getGraphicsSettings, type GraphicsSettings } from "./GraphicsSettings";

export const GRAPHICS_LOST_EVENT = "sfb:graphics-lost";
export const GRAPHICS_RESTORED_EVENT = "sfb:graphics-restored";
export const GRAPHICS_DISPOSED_EVENT = "sfb:graphics-disposed";
export const GRAPHICS_FAILED_EVENT = "sfb:graphics-restore-failed";

/** Shared-memory capacity is not a GPU/driver capability test. */
export function mobileGraphicsDevice(device: Pick<Navigator, "userAgent" | "maxTouchPoints"> = navigator): boolean {
  return /Android|Harmony|iPad|iPhone|Mobile/i.test(device.userAgent)
    || /Macintosh/i.test(device.userAgent) && device.maxTouchPoints > 1;
}

/** Wait for Babylon's restored notification, after its buffers and effects rebuild. */
export function watchGraphicsContext(engine: AbstractEngine, canvas: HTMLCanvasElement, settings: GraphicsSettings = getGraphicsSettings()): void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let generation = 0;
  const cancel = (): void => { generation++; clearTimeout(timer); timer = undefined; };
  const lost = engine.onContextLostObservable.add(() => {
    cancel();
    // A normal page refresh must not immediately retry the same failing path.
    settings.setCompatibility(true);
    canvas.dispatchEvent(new Event(GRAPHICS_LOST_EVENT));
  });
  const restored = engine.onContextRestoredObservable.add(() => {
    cancel();
    const current = generation, deadline = Date.now() + 10_000;
    const check = (): void => {
      if (engine.isDisposed || current !== generation) return;
      try {
        const scenes = engine.scenes.filter(scene => !scene.isDisposed);
        if (scenes.every(scene => scene.isReady())) {
          if (!engine.isWebGPU && engine.getRenderingCanvas() === canvas) {
            const gl = canvas.getContext((engine as ThinEngine).webGLVersion > 1 ? "webgl2" : "webgl") as WebGLRenderingContext | null;
            if (!gl || gl.isContextLost()) throw new Error("Context unavailable");
            // Ignore old driver errors, then validate an actual frozen scene
            // draw. Resource-ready flags alone do not catch invalid VAO state.
            for (let n = 0; n < 16 && gl.getError() !== gl.NO_ERROR; n++) { /* Drain old errors. */ }
            // Async texture rebuilds can change bindings after Babylon's
            // initial cache reset. Rebind everything once all atlases are ready.
            engine.wipeCaches(true);
            for (const scene of scenes) scene.resetCachedMaterial();
            for (const scene of scenes) scene.render(false, true);
            if (gl.getError() !== gl.NO_ERROR) throw new Error("Scene draw failed");
          }
          if (current === generation) canvas.dispatchEvent(new Event(GRAPHICS_RESTORED_EVENT));
          return;
        }
        if (Date.now() < deadline) { timer = setTimeout(check, 100); return; }
      } catch { /* Keep the run paused and retain the DOM escape actions. */ }
      if (current === generation) canvas.dispatchEvent(new Event(GRAPHICS_FAILED_EVENT));
    };
    // Babylon notifies before clearing its own context-lost flag; textures
    // also rebuild asynchronously. Let both finish before returning control.
    timer = setTimeout(check, 0);
  });
  engine.onDisposeObservable.addOnce(() => {
    cancel();
    engine.onContextLostObservable.remove(lost);
    engine.onContextRestoredObservable.remove(restored);
    canvas.dispatchEvent(new Event(GRAPHICS_DISPOSED_EVENT));
  });
}
