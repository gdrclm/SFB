export interface FixedSimulationSystem {
  fixedUpdate(fixedDeltaSeconds: number, realFixedDeltaSeconds?: number): void;
}

export class FixedStepRunner {
  readonly #systems = new Set<FixedSimulationSystem>();
  readonly #fixedStepSeconds: number;
  readonly #maxFrameSeconds: number;
  #accumulatorSeconds = 0;

  public constructor(fixedStepSeconds: number, maxFrameSeconds: number) {
    if (fixedStepSeconds <= 0 || maxFrameSeconds < fixedStepSeconds) {
      throw new RangeError("Invalid fixed-step configuration.");
    }

    this.#fixedStepSeconds = fixedStepSeconds;
    this.#maxFrameSeconds = maxFrameSeconds;
  }

  public register(system: FixedSimulationSystem): void {
    this.#systems.add(system);
  }

  public unregister(system: FixedSimulationSystem): void {
    this.#systems.delete(system);
  }

  public advance(frameDeltaSeconds: number, timeScale = 1): void {
    if (!Number.isFinite(frameDeltaSeconds) || frameDeltaSeconds < 0) {
      throw new RangeError("Frame delta must be a finite non-negative number.");
    }
    if (!Number.isFinite(timeScale) || timeScale <= 0) {
      throw new RangeError("Time scale must be a finite positive number.");
    }

    this.#accumulatorSeconds += Math.min(frameDeltaSeconds, this.#maxFrameSeconds);

    const stepCount = Math.floor(
      (this.#accumulatorSeconds + Number.EPSILON) / this.#fixedStepSeconds,
    );

    for (let step = 0; step < stepCount; step += 1) {
      for (const system of this.#systems) {
        system.fixedUpdate(
          this.#fixedStepSeconds * timeScale,
          this.#fixedStepSeconds,
        );
      }
    }

    this.#accumulatorSeconds -= stepCount * this.#fixedStepSeconds;
  }
}
