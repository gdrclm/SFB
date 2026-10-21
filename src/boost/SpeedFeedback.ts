
export function calculateSpeedFeedback(speed: number): { duration: number; opacity: number; power: number } {
  const safeSpeed = Number.isFinite(speed) ? Math.max(0, speed) : 0;
  const power = Math.max(0, Math.min(1, Math.log2(Math.max(1, safeSpeed / 10)) / 5));
  return {
    duration: 1.1 - .85 * Math.sqrt(power),
    opacity: power === 0 ? 0 : .25 + .7 * Math.sqrt(power),
    power,
  };
}

export class SpeedFeedback {
  readonly #root: HTMLElement;
  readonly #label: HTMLElement;
  #animation: Animation | null = null;
  #burst: Animation | null = null;

  public constructor(root: HTMLElement, label: HTMLElement) {
    this.#root = root;
    this.#label = label;
  }

  public render(speed: number, frozen: boolean): void {
    const feedback = calculateSpeedFeedback(speed);
    this.#root.style.setProperty("--streak-duration", `${String(feedback.duration)}s`);
    this.#root.style.setProperty("--streak-opacity", String(feedback.opacity));
    this.#root.style.setProperty("--wind-power", String(feedback.power));
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
      this.#burst = this.#root.querySelector(".speed-streaks")?.animate([{ filter: "brightness(1)" }, { filter: "brightness(1.8)", offset: .2 }, { filter: "brightness(1)" }], { duration: 450 }) ?? null;
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
