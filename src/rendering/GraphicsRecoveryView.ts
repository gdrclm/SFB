import { GRAPHICS_LOST_EVENT, GRAPHICS_RESTORED_EVENT, GRAPHICS_DISPOSED_EVENT } from "./GraphicsContext";
import { getGraphicsSettings } from "./GraphicsSettings";

/** DOM recovery remains usable while WebGL cannot draw a single frame. */
export function initializeGraphicsRecovery(canvas: HTMLCanvasElement, restart: () => void): void {
  const panel = document.querySelector<HTMLElement>("#graphics-recovery");
  const retry = document.querySelector<HTMLButtonElement>("#graphics-recovery-retry");
  if (!(panel instanceof HTMLDialogElement) || !retry) throw new Error("Graphics recovery controls are missing.");
  canvas.addEventListener(GRAPHICS_LOST_EVENT, () => { panel.hidden = false; if (!panel.open) panel.showModal(); retry.focus({ preventScroll: true }); });
  panel.addEventListener("cancel", event => { event.preventDefault(); });
  const hide = (): void => { if (panel.open) panel.close(); panel.hidden = true; };
  canvas.addEventListener(GRAPHICS_RESTORED_EVENT, hide);
  canvas.addEventListener(GRAPHICS_DISPOSED_EVENT, hide);
  retry.addEventListener("click", () => { getGraphicsSettings().setCompatibility(true); restart(); });
}
