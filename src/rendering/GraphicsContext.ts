import type { AbstractEngine } from "@babylonjs/core/Engines/abstractEngine";
import { getGraphicsSettings, type GraphicsSettings } from "./GraphicsSettings";

export const GRAPHICS_LOST_EVENT = "sfb:graphics-lost";
export const GRAPHICS_RESTORED_EVENT = "sfb:graphics-restored";
export const GRAPHICS_DISPOSED_EVENT = "sfb:graphics-disposed";

/** Shared-memory capacity is not a GPU/driver capability test. */
export function mobileGraphicsDevice(device: Pick<Navigator, "userAgent" | "maxTouchPoints"> = navigator): boolean {
  return /Android|Harmony|iPad|iPhone|Mobile/i.test(device.userAgent)
    || /Macintosh/i.test(device.userAgent) && device.maxTouchPoints > 1;
}

/** Wait for Babylon's restored notification, after its buffers and effects rebuild. */
export function watchGraphicsContext(engine: AbstractEngine, canvas: HTMLCanvasElement, settings: GraphicsSettings = getGraphicsSettings()): void {
  const lost = engine.onContextLostObservable.add(() => {
    // A normal page refresh must not immediately retry the same failing path.
    settings.setCompatibility(true);
    canvas.dispatchEvent(new Event(GRAPHICS_LOST_EVENT));
  });
  const restored = engine.onContextRestoredObservable.add(() => {
    canvas.dispatchEvent(new Event(GRAPHICS_RESTORED_EVENT));
  });
  engine.onDisposeObservable.addOnce(() => {
    engine.onContextLostObservable.remove(lost);
    engine.onContextRestoredObservable.remove(restored);
    canvas.dispatchEvent(new Event(GRAPHICS_DISPOSED_EVENT));
  });
}
