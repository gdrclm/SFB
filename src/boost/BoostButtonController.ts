import type { BoostController } from "./BoostController";

export class BoostButtonController {
  readonly #button: HTMLButtonElement;
  readonly #costLabel: HTMLElement;
  readonly #energyLabel: HTMLElement;
  readonly #stateLabel: HTMLElement | null;
  readonly #boost: BoostController;
  readonly #onRejected: () => void;

  public constructor(
    button: HTMLButtonElement,
    costLabel: HTMLElement,
    energyLabel: HTMLElement,
    boost: BoostController,
    onRejected: () => void = () => {},
  ) {
    this.#button = button;
    this.#costLabel = costLabel;
    this.#energyLabel = energyLabel;
    this.#stateLabel = button.querySelector<HTMLElement>(".boost-state");
    this.#boost = boost;
    this.#onRejected = onRejected;
    button.addEventListener("click", this.#onClick);
    this.render();
  }

  public render(): void {
    const progress = Math.max(0, Math.min(1, this.#boost.cooldownProgress));
    this.#button.disabled = false;
    this.#button.setAttribute("aria-disabled", String(!this.#boost.canBoost));
    this.#button.classList.toggle("boost-ready", this.#boost.canBoost && progress <= 0);
    this.#button.style.setProperty("--cooldown-progress", progress.toString());
    this.#button.style.setProperty("--cooldown-angle", `${String(progress * 360)}deg`);
    this.#button.setAttribute(
      "aria-label",
      `Boost: +50% к скорости. Цена ${String(this.#boost.energyCost)}. Энергия ${String(this.#boost.energy)}.`,
    );
    this.#costLabel.textContent = `−${String(this.#boost.energyCost)}⚡`;
    this.#energyLabel.textContent = String(this.#boost.energy);
    this.#energyLabel.setAttribute(
      "aria-label",
      `Энергия: ${String(this.#boost.energy)}`,
    );
    if (this.#stateLabel !== null) {
      this.#stateLabel.textContent =
        progress > 0
          ? "ЗАРЯДКА"
          : this.#boost.energy < this.#boost.energyCost
            ? "ПУСТО"
            : this.#boost.canBoost
              ? "ГОТОВО"
              : "БЛОК";
    }
  }

  public dispose(): void {
    this.#button.removeEventListener("click", this.#onClick);
  }

  readonly #onClick = (event: MouseEvent): void => {
    const result = this.#boost.tryBoost();
    if (result.success) {
      this.#animateSuccess();
    } else if (event.isTrusted) {
      this.#onRejected();
    }
    this.render();
  };

  #animateSuccess(): void {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    this.#button.animate(
      [
        { transform: "scale(1)" },
        { transform: "scale(1.16)" },
        { transform: "scale(1)" },
      ],
      { duration: 180, easing: "ease-out" },
    );
  }
}
