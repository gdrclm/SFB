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
    this.#button.style.setProperty("--charge-angle", `${String(this.#boost.chargeProgress * 360)}deg`);
    this.#button.dataset.charged = String(this.#boost.hasCharge);
    this.#button.setAttribute(
      "aria-label",
      `BOOST: ${this.#boost.hasCharge ? "заряд готов" : `${String(this.#boost.chargeHits)} из ${String(this.#boost.hitsRequired)} пробитий подряд`}. +50% скорости. Цена ${String(this.#boost.energyCost)} энергии.`,
    );
    this.#costLabel.hidden = !this.#boost.hasCharge || this.#boost.energyCost <= 1 && this.#boost.energy >= this.#boost.energyCost * 3;
    this.#costLabel.textContent = `−${String(this.#boost.energyCost)}⚡`;
    this.#energyLabel.textContent = String(this.#boost.energy);
    this.#energyLabel.setAttribute(
      "aria-label",
      `Энергия: ${String(this.#boost.energy)}`,
    );
    if (this.#stateLabel !== null) {
      this.#stateLabel.textContent =
        !this.#boost.hasCharge
          ? `${String(this.#boost.chargeHits)}/${String(this.#boost.hitsRequired)}`
          : progress > 0
            ? "ЖДИ"
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

  public playCharged(): void { this.render(); this.#animateSuccess(); }

  readonly #onClick = (event: MouseEvent): void => { this.activate(event.isTrusted); };

  public activate(feedbackOnReject = true): void {
    const result = this.#boost.tryBoost();
    if (result.success) {
      this.#animateSuccess();
    } else if (feedbackOnReject) {
      this.#onRejected();
    }
    this.render();
  }

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
