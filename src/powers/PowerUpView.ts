import type { PowerKind, PowerUpController } from "./PowerUpController";
/** Reuses the original left-hand ability button, so the HUD always has two controls. */
export class PowerUpView {
  readonly #button: HTMLButtonElement;
  readonly #powers: PowerUpController;
  readonly #kind: PowerKind;
  public constructor(button: HTMLButtonElement, powers: PowerUpController, kind: PowerKind) {
    this.#button = button; this.#powers = powers; this.#kind = kind;
    button.dataset.power = kind; button.classList.remove("slow-mode-active");
    const icon = button.querySelector(".slow-mode-value");
    const title = button.querySelector(".slow-mode-title");
    const name = kind === "plasma" ? "Плазменный разгон" : "Аннигиляция";
    if (icon !== null) icon.textContent = kind === "plasma" ? "✺" : "◉";
    if (title !== null) title.textContent = name;
    button.setAttribute("aria-label", `${name}: активировать один раз за забег`);
    button.title = `${name} · один раз за забег`;
    button.addEventListener("click", this.#onClick);
    this.render(false);
  }
  readonly #onClick = (): void => { this.#powers.tryActivate(this.#kind); this.render(false); };
  public render(blocked: boolean): void {
    const active = this.#kind === "plasma" && this.#powers.invulnerable;
    this.#button.disabled = blocked || !this.#powers.available(this.#kind);
    this.#button.setAttribute("aria-pressed", String(active));
    this.#button.dataset.active = String(active);
    this.#button.dataset.spent = String(!this.#powers.available(this.#kind) && !active);
    const label = this.#button.querySelector(".slow-mode-state");
    if (label !== null) label.textContent = active ? `${String(Math.ceil(this.#powers.plasmaRemaining))} с`
      : this.#powers.available(this.#kind) ? this.#kind === "plasma" ? "30 с" : "200 м" : "—";
  }
  public dispose(): void {
    this.#button.removeEventListener("click", this.#onClick);
    delete this.#button.dataset.power; delete this.#button.dataset.active; delete this.#button.dataset.spent;
    this.#button.title = "";
    const icon = this.#button.querySelector(".slow-mode-value"), title = this.#button.querySelector(".slow-mode-title");
    if (icon !== null) icon.textContent = "◷";
    if (title !== null) title.textContent = "ЗАМЕДЛЕНИЕ";
  }
}
