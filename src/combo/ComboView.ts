import { ComboVisibility } from "./ComboVisibility";
import { type ComboController, type ComboHit } from "./ComboController";

export class ComboView {
  readonly #panel: HTMLElement;
  readonly #number: HTMLElement;
  readonly #multiplier: HTMLElement;
  readonly #heading: HTMLElement;
  readonly #fill: HTMLElement;
  readonly #flare: HTMLElement;
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
    this.#heading = element(".combo-heading");
    this.#fill = element("#combo-fill");
    this.#flare = document.createElement("span");
    this.#flare.className = "combo-flare";
    this.#flare.setAttribute("aria-hidden", "true");
    panel.prepend(this.#flare);
  }

  public render(combo: ComboController): void {
    this.#number.textContent = String(combo.count);
    this.#multiplier.textContent = `×${String(combo.multiplier)}`;
    this.#panel.dataset.tier = String(combo.multiplier);
    this.#fill.style.transform = `scaleX(${String(combo.progress)})`;
  }

  public hit(hit: ComboHit): void {
    this.#visibility.show(hit.tierIncreased ? 1.1 : .75);
    this.#updateVisibility();
    this.#animate(hit.tierIncreased);
  }

  public miss(): void {
    this.#visibility.reset();
    this.#updateVisibility();
    for (const animation of this.#animations) animation.cancel();
    this.#animations = [];
  }

  #animate(milestone: boolean): void {
    for (const animation of this.#animations) animation.cancel();
    this.#animations = [];
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    this.#animations.push(this.#heading.animate(
      [{ transform: "translateY(4px) scale(.8)", filter: "brightness(1.8)" },
        { transform: `translateY(-2px) scale(${milestone ? "1.4" : "1.2"})`, filter: "brightness(1.4)", offset: .25 },
        { transform: "translateY(0) scale(1)", filter: "brightness(1)" }],
      { duration: milestone ? 450 : 300, easing: "ease-out" },
    ));
    this.#animations.push(this.#flare.animate(
      [{ transform: "translate(-50%, -50%) scale(.35)", opacity: .5 },
        { transform: `translate(-50%, -50%) scale(${milestone ? "1.8" : "1.3"})`, opacity: 0 }],
      { duration: milestone ? 450 : 300, easing: "ease-out" },
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
    this.#flare.remove();
    this.#visibility.reset();
    this.#updateVisibility();
  }
}
