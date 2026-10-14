import type { GameConfig, PhaseOneStageConfig } from "../config/gameConfig";
import type { FixedSimulationSystem } from "../core/FixedStepRunner";

export interface PhaseOneDifficulty {
  readonly stageNumber: number;
  readonly platformStrength: number;
  readonly reactionWindowSeconds: number;
}

export type PhaseOneStageListener = (stageNumber: number) => void;
export type PhaseOneCompletionListener = () => void;

function lerp(start: number, end: number, amount: number): number {
  return start + (end - start) * Math.max(0, Math.min(1, amount));
}

export class PhaseOneController implements FixedSimulationSystem {
  readonly #stages: readonly PhaseOneStageConfig[];
  readonly #stageListeners = new Set<PhaseOneStageListener>();
  readonly #completionListeners = new Set<PhaseOneCompletionListener>();
  #stageIndex = 0;
  #stageElapsedSeconds = 0;
  #phaseElapsedSeconds = 0;
  #isComplete = false;

  public constructor(config: GameConfig) {
    this.#stages = config.phaseOne.stages;
    if (this.#stages.length !== 10) {
      throw new RangeError("Phase one must contain exactly ten stages.");
    }
    for (const [index, stage] of this.#stages.entries()) {
      if (stage.number !== index + 1 || stage.durationSeconds <= 0) {
        throw new RangeError("Phase one stages must be sequential and have positive duration.");
      }
    }
  }

  public get currentStageNumber(): number {
    return this.#currentStage.number;
  }

  public get stageProgress(): number {
    if (this.#isComplete) {
      return 1;
    }
    return Math.min(1, this.#stageElapsedSeconds / this.#currentStage.durationSeconds);
  }

  public get phaseElapsedSeconds(): number {
    return this.#phaseElapsedSeconds;
  }

  public get totalDurationSeconds(): number {
    return this.#stages.reduce((total, stage) => total + stage.durationSeconds, 0);
  }

  public get isComplete(): boolean {
    return this.#isComplete;
  }

  public get currentDifficulty(): PhaseOneDifficulty {
    const stage = this.#currentStage;
    const progress = this.stageProgress;
    return {
      stageNumber: stage.number,
      platformStrength: lerp(
        stage.platformStrength.minimum,
        stage.platformStrength.maximum,
        progress,
      ),
      reactionWindowSeconds: lerp(
        stage.reactionWindowSeconds.maximum,
        stage.reactionWindowSeconds.minimum,
        progress,
      ),
    };
  }

  public onStageChanged(listener: PhaseOneStageListener): () => void {
    this.#stageListeners.add(listener);
    return () => {
      this.#stageListeners.delete(listener);
    };
  }

  public onCompleted(listener: PhaseOneCompletionListener): () => void {
    this.#completionListeners.add(listener);
    return () => {
      this.#completionListeners.delete(listener);
    };
  }

  public fixedUpdate(fixedDeltaSeconds: number): void {
    if (this.#isComplete || fixedDeltaSeconds <= 0) {
      return;
    }

    let remainingSeconds = fixedDeltaSeconds;
    while (remainingSeconds > 0) {
      const remainingStageSeconds =
        this.#currentStage.durationSeconds - this.#stageElapsedSeconds;
      const consumedSeconds = Math.min(remainingSeconds, remainingStageSeconds);
      this.#stageElapsedSeconds += consumedSeconds;
      this.#phaseElapsedSeconds += consumedSeconds;
      remainingSeconds -= consumedSeconds;

      if (
        this.#stageElapsedSeconds + Number.EPSILON <
        this.#currentStage.durationSeconds
      ) {
        continue;
      }

      if (this.#advanceStage()) {
        break;
      }
    }
  }

  get #currentStage(): PhaseOneStageConfig {
    const stage = this.#stages[this.#stageIndex];
    if (stage === undefined) {
      throw new Error("Current phase-one stage is missing.");
    }
    return stage;
  }

  #advanceStage(): boolean {
    if (this.#stageIndex >= this.#stages.length - 1) {
      this.#stageElapsedSeconds = this.#currentStage.durationSeconds;
      this.#isComplete = true;
      for (const listener of this.#completionListeners) {
        listener();
      }
      return true;
    }

    this.#stageIndex += 1;
    this.#stageElapsedSeconds = 0;
    for (const listener of this.#stageListeners) {
      listener(this.currentStageNumber);
    }
    return false;
  }
}
