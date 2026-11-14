import { getGraphicsSettings, isGraphicsMode } from "./GraphicsSettings";

const descriptions = {
  auto: "Подбирает чёткость по скорости устройства.",
  low: "Меньше нагрузка и проще эффекты.",
  medium: "Баланс чёткости и плавности.",
  high: "Повышенная чёткость объектов и персонажа.",
  ultra: "Максимальная чёткость. Для мощных устройств.",
} as const;

export function initializeGraphicsControls(): void {
  const select = document.querySelector("#graphics-quality");
  const hint = document.querySelector("#graphics-quality-hint");
  if (!(select instanceof HTMLSelectElement) || hint === null) throw new Error("Graphics controls are missing.");
  const settings = getGraphicsSettings();
  const render = (): void => {
    select.value = settings.mode;
    hint.textContent = descriptions[settings.mode];
  };
  select.addEventListener("change", () => {
    if (isGraphicsMode(select.value)) settings.set(select.value);
  });
  settings.subscribe(render);
  render();
}
