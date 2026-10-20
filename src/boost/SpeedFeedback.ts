import type { SuccessfulBoostResult } from "./BoostController";

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

  public constructor(root: HTMLElement, label: HTMLElement) {
    this.#root = root;
    this.#label = label;
  }

  public render(speed: number, frozen: boolean): void {
    const feedback = calculateSpeedFeedback(speed);
    this.#root.style.setProperty("--streak-duration", `${String(feedback.duration)}s`);
    this.#root.style.setProperty("--streak-opacity", String(feedback.opacity));
    this.#root.classList.toggle("speed-frozen", frozen);
  }

  public playBoost(result: SuccessfulBoostResult): void {
    this.#label.textContent = `BOOST +${((result.currentSpeed / result.previousSpeed - 1) * 100).toFixed(0)}% · ${result.previousSpeed.toFixed(1)} → ${result.currentSpeed.toFixed(1)}`;
    this.#animation?.cancel();
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
    this.#label.textContent = "";
    this.#root.style.setProperty("--streak-opacity", "0");
    this.#root.classList.add("speed-frozen");
  }
}
