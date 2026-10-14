import type { SlowModeController } from "./SlowModeController";

export class SlowModeButtonController {
  readonly #button: HTMLButtonElement;
  readonly #slowMode: SlowModeController;
  readonly #stateLabel: HTMLElement | null;

  public constructor(button: HTMLButtonElement, slowMode: SlowModeController) {
    this.#button = button;
    this.#slowMode = slowMode;
    this.#stateLabel = button.querySelector<HTMLElement>(".slow-mode-state");
    button.addEventListener("click", this.#onClick);
    this.render();
  }

  public render(): void {
    const isActive = this.#slowMode.isActive;
    const isForced = this.#slowMode.isForced;
    this.#button.disabled =
      isForced || (!isActive && !this.#slowMode.canActivate);
    this.#button.classList.toggle("slow-mode-active", isActive);
    this.#button.setAttribute("aria-pressed", String(isActive));
    this.#button.setAttribute(
      "aria-label",
      isForced
        ? "Принудительное замедление активно."
        : isActive
        ? "Замедление активно. Нажмите, чтобы выключить."
        : "Нажмите, чтобы включить замедление времени до 10 процентов.",
    );
    if (this.#stateLabel !== null) {
      this.#stateLabel.textContent = isActive
        ? isForced
          ? "ПРИНУДИТ."
          : "АКТИВНО"
        : this.#slowMode.canActivate
          ? "ГОТОВО"
          : "ПУСТО";
    }
  }

  public dispose(): void {
    this.#button.removeEventListener("click", this.#onClick);
    this.#slowMode.reset();
  }

  readonly #onClick = (): void => {
    this.#slowMode.toggle();
    this.render();
  };
}
