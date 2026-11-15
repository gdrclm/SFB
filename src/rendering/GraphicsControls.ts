import { getGraphicsSettings, isGraphicsMode } from "./GraphicsSettings";

const descriptions = {
  auto: "Подбирает чёткость по скорости устройства.",
  low: "Меньше нагрузка и проще эффекты.",
  medium: "Баланс чёткости и плавности.",
  high: "Повышенная чёткость объектов и персонажа.",
  ultra: "Максимальная чёткость. Для мощных устройств.",
} as const;

export function initializeGraphicsControls(restart: () => void): void {
  const select = document.querySelector("#graphics-quality");
  const hint = document.querySelector("#graphics-quality-hint");
  if (!(select instanceof HTMLSelectElement) || hint === null) throw new Error("Graphics controls are missing.");
  const settings = getGraphicsSettings();
  const compatibility = document.querySelector("#graphics-compatibility");
  const apply = document.querySelector("#graphics-restart");
  if (!(compatibility instanceof HTMLInputElement) || !(apply instanceof HTMLButtonElement)) throw new Error("Graphics compatibility controls are missing.");
  if (new URLSearchParams(window.location.search).get("renderer") === "webgl1") settings.setCompatibility(true);
  const initialCompatibility = settings.compatibility;
  const render = (): void => {
    select.value = settings.mode;
    hint.textContent = descriptions[settings.mode];
    compatibility.checked = settings.compatibility;
    const active = document.documentElement.dataset.graphicsCompatibility;
    apply.hidden = settings.compatibility === (active === undefined ? initialCompatibility : active === "true");
  };
  select.addEventListener("change", () => {
    if (isGraphicsMode(select.value)) settings.set(select.value);
  });
  compatibility.addEventListener("change", () => { settings.setCompatibility(compatibility.checked); });
  apply.addEventListener("click", restart);
  new MutationObserver(render).observe(document.documentElement, { attributes: true, attributeFilter: ["data-graphics-compatibility"] });
  settings.subscribe(render);
  render();
}
