import type { GameConfig } from "../config/gameConfig";
import { GameState, type GameStateController } from "../core/GameStateController";
import type { RunWallet } from "../currency/RunWallet";

const ENERGY_EPSILON = 1e-9;

export class SlowModeController {
  readonly #gameState: Pick<GameStateController, "current" | "transitionTo">;
  readonly #wallet: Pick<RunWallet, "energy" | "drainEnergy">;
  readonly #config: GameConfig["slowMode"];
  #elapsedRealSeconds = 0;
  #forcedRemainingRealSeconds = 0;
  readonly #onActiveChanged: (active: boolean) => void;

  public constructor(
    gameState: Pick<GameStateController, "current" | "transitionTo">,
    wallet: Pick<RunWallet, "energy" | "drainEnergy">,
    config: GameConfig,
    onActiveChanged: (active: boolean) => void = () => {},
  ) {
    this.#gameState = gameState;
    this.#wallet = wallet;
    this.#config = config.slowMode;
    this.#onActiveChanged = onActiveChanged;
  }

  public get isActive(): boolean {
    return this.#gameState.current === GameState.SlowMode;
  }

  public get canActivate(): boolean {
    return (
      this.#gameState.current === GameState.Playing &&
      this.#wallet.energy + ENERGY_EPSILON >= this.#config.energyCost
    );
  }

  public get isForced(): boolean {
    return this.#forcedRemainingRealSeconds > ENERGY_EPSILON;
  }

  public get timeScale(): number {
    return this.isActive ? this.#config.timeScale : 1;
  }

  public toggle(): boolean {
    if (this.isForced) {
      return true;
    }
    if (this.isActive) {
      this.requestStop();
      return false;
    }

    return this.requestStart();
  }

  public requestStart(): boolean {
    if (!this.canActivate) {
      return false;
    }

    this.#elapsedRealSeconds = 0;
    this.#gameState.transitionTo(GameState.SlowMode);
    this.#onActiveChanged(true);
    return true;
  }

  public requestStop(): void {
    if (this.isForced) {
      return;
    }
    this.#elapsedRealSeconds = 0;
    if (this.isActive) {
      this.#gameState.transitionTo(GameState.Playing);
      this.#onActiveChanged(false);
    }
  }

  public forceStart(durationRealSeconds: number): boolean {
    if (!Number.isFinite(durationRealSeconds) || durationRealSeconds <= 0) {
      throw new RangeError("Forced Slow Mode duration must be finite and positive.");
    }
    if (
      this.#gameState.current !== GameState.Playing &&
      this.#gameState.current !== GameState.SlowMode
    ) {
      return false;
    }

    const wasActive = this.isActive;
    this.#elapsedRealSeconds = 0;
    this.#forcedRemainingRealSeconds = Math.max(
      this.#forcedRemainingRealSeconds,
      durationRealSeconds,
    );
    this.#gameState.transitionTo(GameState.SlowMode);
    if (!wasActive) this.#onActiveChanged(true);
    return true;
  }

  public reset(): void {
    this.#elapsedRealSeconds = 0;
    this.#forcedRemainingRealSeconds = 0;
    if (this.isActive) {
      this.#gameState.transitionTo(GameState.Playing);
    }
  }

  public update(realDeltaSeconds: number): number {
    if (!Number.isFinite(realDeltaSeconds) || realDeltaSeconds < 0) {
      throw new RangeError("Real delta must be a finite non-negative number.");
    }

    if (!this.isActive) {
      this.#elapsedRealSeconds = 0;
      this.#forcedRemainingRealSeconds = 0;
      return 1;
    }

    if (this.isForced) {
      const nextForcedRemainingSeconds = Math.max(
        0,
        this.#forcedRemainingRealSeconds - realDeltaSeconds,
      );
      this.#forcedRemainingRealSeconds = nextForcedRemainingSeconds;
      if (nextForcedRemainingSeconds <= ENERGY_EPSILON) {
        this.#gameState.transitionTo(GameState.Playing);
        this.#onActiveChanged(false);
      }
      return this.#config.timeScale;
    }

    this.#elapsedRealSeconds += realDeltaSeconds;
    const completedIntervals = Math.floor(
      (this.#elapsedRealSeconds + Number.EPSILON) /
        this.#config.energyIntervalRealSeconds,
    );
    if (completedIntervals <= 0) {
      return this.#config.timeScale;
    }

    this.#elapsedRealSeconds = Math.max(
      0,
      this.#elapsedRealSeconds -
        completedIntervals * this.#config.energyIntervalRealSeconds,
    );
    const requestedEnergy = completedIntervals * this.#config.energyCost;
    this.#wallet.drainEnergy(requestedEnergy);
    if (
      this.#wallet.energy <= ENERGY_EPSILON
    ) {
      this.requestStop();
    }

    return this.#config.timeScale;
  }
}
