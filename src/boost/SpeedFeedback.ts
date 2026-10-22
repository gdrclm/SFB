
export function calculateSpeedFeedback(speed: number): { duration: number; opacity: number; power: number; length: number; width: number; lanes: number } {
  const safeSpeed = Number.isFinite(speed) ? Math.max(0, speed) : 0;
  const power = Math.max(0, Math.min(1, Math.log2(Math.max(1, safeSpeed / 10)) / 5));
  return {
    duration: 1.45 - 1.2 * power,
    opacity: power === 0 ? 0 : .08 + .86 * power ** .9,
    length: 8 + 48 * power ** 1.2,
    width: 1.4 + 4.2 * power,
    lanes: power === 0 ? 0 : 1 + 11 * power,
    power,
  };
}

export class SpeedFeedback {
  readonly #root: HTMLElement;
  readonly #label: HTMLElement;
  #animation: Animation | null = null;
  #burst: Animation | null = null;
  #opacity = 0;

  public constructor(root: HTMLElement, label: HTMLElement) {
    this.#root = root;
    this.#label = label;
  }

  public render(speed: number, frozen: boolean): void {
    const feedback = calculateSpeedFeedback(speed);
    this.#opacity = feedback.opacity;
    this.#root.style.setProperty("--streak-duration", `${String(feedback.duration)}s`);
    this.#root.style.setProperty("--streak-opacity", String(feedback.opacity));
    this.#root.style.setProperty("--wind-power", String(feedback.power));
    this.#root.style.setProperty("--streak-length", `${String(feedback.length)}vh`);
    this.#root.style.setProperty("--streak-width", `${String(feedback.width)}px`);
    this.#root.style.setProperty("--streak-lanes", String(feedback.lanes));
    this.#root.classList.toggle("speed-frozen", frozen);
    for (const animation of [this.#animation, this.#burst]) {
      if (frozen && animation?.playState === "running") animation.pause();
      else if (!frozen && animation?.playState === "paused") animation.play();
    }
  }

  public playBoost(): void {
    this.#label.textContent = "ϟ";
    this.#animation?.cancel();
    this.#burst?.cancel();
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      this.#burst = this.#root.querySelector(".speed-streaks")?.animate([{ opacity: this.#opacity, transform: "scaleX(1)" }, { opacity: .7 + this.#opacity * .3, transform: "scaleX(.97)", offset: .15 }, { opacity: this.#opacity, transform: "scaleX(1)" }], { duration: 500, easing: "ease-out" }) ?? null;
    }
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.#animation = this.#label.animate(
      reducedMotion
        ? [{ opacity: 1 }, { opacity: 1 }, { opacity: 0 }]
        : [{ opacity: 1, transform: "translateY(8px) scale(0.95)" },
          { opacity: 1, transform: "translateY(0) scale(1.05)", offset: 0.2 },
          { opacity: 0, transform: "translateY(-12px) scale(1)" }],
      { duration: 1100, fill: "forwards", easing: "ease-out" },
    );
  }

  public dispose(): void {
    this.#animation?.cancel();
    this.#burst?.cancel();
    this.#label.textContent = "";
    this.#root.style.setProperty("--streak-opacity", "0");
    this.#root.classList.add("speed-frozen");
  }
}
