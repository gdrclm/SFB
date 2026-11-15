import { GRAPHICS_LOST_EVENT, GRAPHICS_RESTORED_EVENT, GRAPHICS_DISPOSED_EVENT, GRAPHICS_FAILED_EVENT } from "./GraphicsContext";
import { getGraphicsSettings } from "./GraphicsSettings";

/** DOM recovery remains usable while WebGL cannot draw a single frame. */
export function initializeGraphicsRecovery(canvas: HTMLCanvasElement, restart: () => void, openSettings: () => void): void {
  const panel = document.querySelector<HTMLElement>("#graphics-recovery");
  const retry = document.querySelector<HTMLButtonElement>("#graphics-recovery-retry");
  const settings = document.querySelector<HTMLButtonElement>("#graphics-recovery-settings");
  const title = document.querySelector("#graphics-recovery-title");
  const description = document.querySelector("#graphics-recovery-description");
  if (!(panel instanceof HTMLDialogElement) || !retry || !settings || !title || !description) throw new Error("Graphics recovery controls are missing.");
  canvas.addEventListener(GRAPHICS_LOST_EVENT, () => {
    title.textContent = "Графика восстанавливается";
    description.textContent = "Забег на паузе. Можно дождаться восстановления или выйти в настройки.";
    panel.hidden = false; if (!panel.open) panel.showModal(); settings.focus({ preventScroll: true });
  });
  canvas.addEventListener(GRAPHICS_FAILED_EVENT, () => {
    title.textContent = "Сцена не восстановилась";
    description.textContent = "Сохрани результат и открой настройки или перезапусти графику.";
  });
  panel.addEventListener("cancel", event => { event.preventDefault(); });
  const hide = (): void => { if (panel.open) panel.close(); panel.hidden = true; };
  canvas.addEventListener(GRAPHICS_RESTORED_EVENT, hide);
  canvas.addEventListener(GRAPHICS_DISPOSED_EVENT, hide);
  retry.addEventListener("click", () => { getGraphicsSettings().setCompatibility(true); restart(); });
  settings.addEventListener("click", openSettings);
}
