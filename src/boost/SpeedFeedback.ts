
export function calculateSpeedFeedback(speed: number): { duration: number; opacity: number } {
  const safeSpeed = Math.max(0, speed);
  return {
    duration: Math.max(0.08, 18 / Math.max(1, safeSpeed)),
    opacity: Math.min(0.55, safeSpeed / 100),
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
      this.#burst = this.#root.querySelector(".speed-streaks")?.animate([{ opacity: .85 }, { opacity: .55, offset: .5 }, { opacity: 0 }], { duration: 850 }) ?? null;
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
