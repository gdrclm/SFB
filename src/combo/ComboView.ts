import { ComboVisibility } from "./ComboVisibility";
import { type ComboController, type ComboHit } from "./ComboController";

export class ComboView {
  readonly #panel: HTMLElement;
  readonly #number: HTMLElement;
  readonly #multiplier: HTMLElement;
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
  }

  public render(combo: ComboController): void {
    this.#number.textContent = String(combo.count);
    this.#multiplier.textContent = `×${String(combo.multiplier)}`;
    this.#panel.dataset.tier = String(combo.multiplier);
  }

  public hit(hit: ComboHit): void {
    this.#visibility.show(hit.tierIncreased ? 1.1 : .75);
    this.#updateVisibility();
    this.#animate(false, hit.tierIncreased);
  }

  public miss(): void {
    this.#visibility.reset();
    this.#updateVisibility();
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
