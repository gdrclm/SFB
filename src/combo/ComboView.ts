import { ComboVisibility } from "./ComboVisibility";
import { assessRisk, speedMultiplier, type ComboController, type ComboHit } from "./ComboController";

export class ComboView {
  readonly #panel: HTMLElement;
  readonly #number: HTMLElement;
  readonly #multiplier: HTMLElement;
  readonly #next: HTMLElement;
  readonly #bar: HTMLElement;
  readonly #risk: HTMLElement;
  readonly #message: HTMLElement;
  #animations: Animation[] = [];
  readonly #visibility = new ComboVisibility();

  public constructor(panel: HTMLElement) {
    this.#panel = panel;
    this.#updateVisibility();
    const element = (selector: string): HTMLElement => {
      const node = panel.querySelector<HTMLElement>(selector);
      if (node === null) throw new Error(`Missing combo element: ${selector}`);
      return node;
    };
    this.#number = element("#combo-count"); this.#multiplier = element("#combo-multiplier");
    this.#next = element("#combo-next"); this.#bar = element("#combo-progress");
    this.#risk = element("#combo-risk"); this.#message = element("#combo-message");
  }

  public render(combo: ComboController, speed: number, strength: number | null): void {
    this.#number.textContent = String(combo.count);
    this.#multiplier.textContent = `×${String(combo.multiplier)}`;
    this.#panel.dataset.tier = String(combo.multiplier);
    this.#bar.style.transform = `scaleX(${String(combo.progress)})`;
    this.#next.textContent = combo.nextThreshold === null ? "МАКСИМУМ ×5 · держите серию"
      : `Ещё ${String(combo.nextThreshold - combo.count)} до ×${String(combo.multiplier + 1)}`;
    const risk = strength === null ? "safe" : assessRisk(speed, strength);
    this.#panel.dataset.risk = strength === null ? "none" : risk;
    const speedText = `Скорость ×${speedMultiplier(speed).toLocaleString("ru-RU")}`;
    this.#risk.textContent = strength === null ? `${speedText} · выберите платформу`
      : risk === "blocked" ? `НЕ ПРОБЬЁШЬ ${strength.toFixed(0)} · BOOST или обход`
        : risk === "edge" ? `${speedText} · НА ГРАНИ: бонус ×1,5`
          : `${speedText} · есть запас для удара`;
  }

  public hit(hit: ComboHit): void {
    if (hit.multiplier >= 2) this.#visibility.show();
    else this.#visibility.reset();
    this.#updateVisibility();
    this.#message.textContent = `+${String(hit.points)} ${hit.risky ? "· НА ГРАНИ!" : "· УСПЕШНЫЙ УДАР"}${hit.tierIncreased ? ` · КОМБО ×${String(hit.multiplier)}!` : ""}`;
    this.#animate(false, hit.tierIncreased);
  }

  public miss(lost: number): void {
    this.#visibility.reset();
    this.#updateVisibility();
    this.#message.textContent = lost > 0 ? `Серия ${String(lost)} потеряна · начните новую` : "Ошибка · соберите новую серию";
    this.#animate(true, false);
  }

  #animate(failed: boolean, milestone: boolean): void {
    for (const animation of this.#animations) animation.cancel();
    this.#animations = [];
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    this.#animations.push(this.#number.animate(
      [{ transform: "scale(1)" }, { transform: `scale(${milestone ? "1.6" : "1.25"})` }, { transform: "scale(1)" }],
      { duration: milestone ? 500 : 240, easing: "ease-out" },
    ));
    this.#animations.push(this.#panel.animate(
      failed ? [{ boxShadow: "0 0 32px #ff527e", borderColor: "#ff527e" }, { boxShadow: "0 0 0 transparent" }]
        : [{ filter: `brightness(${milestone ? "1.8" : "1.35"})` }, { filter: "brightness(1)" }],
      { duration: failed ? 600 : milestone ? 650 : 280, easing: "ease-out" },
    ));
  }

  public fixedUpdate(delta: number, realDeltaSeconds = delta): void {
    this.#visibility.advance(realDeltaSeconds);
    this.#updateVisibility();
  }

  #updateVisibility(): void {
    this.#panel.dataset.visible = String(this.#visibility.visible);
    this.#panel.setAttribute("aria-hidden", String(!this.#visibility.visible));
  }

  public setPaused(paused: boolean): void {
    for (const animation of this.#animations) {
      if (paused && animation.playState === "running") animation.pause();
      else if (!paused && animation.playState === "paused") animation.play();
    }
  }
  public dispose(): void {
    for (const animation of this.#animations) animation.cancel();
    this.#visibility.reset();
    this.#updateVisibility();
  }
}
