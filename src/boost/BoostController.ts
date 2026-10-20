import type { BallController } from "../ball/BallController";
import type { GameConfig } from "../config/gameConfig";
import type { FixedSimulationSystem } from "../core/FixedStepRunner";
import { GameState, type GameStateController } from "../core/GameStateController";
import type { RunWallet } from "../currency/RunWallet";

export type BoostFailureReason =
  | "cooldown"
  | "slow-mode"
  | "bounce-recovery"
  | "game-not-playing"
  | "insufficient-energy";

export interface SuccessfulBoostResult {
  readonly success: true;
  readonly previousSpeed: number;
  readonly currentSpeed: number;
  readonly energyCost: number;
}

export type BoostResult =
  | SuccessfulBoostResult
  | {
      readonly success: false;
      readonly reason: BoostFailureReason;
    };

export type BoostListener = (result: SuccessfulBoostResult) => void;

export class BoostController implements FixedSimulationSystem {
  readonly #ball: Pick<BallController, "fallSpeed">;
  readonly #gameState: Pick<GameStateController, "current">;
  readonly #wallet: Pick<RunWallet, "energy" | "spendEnergy">;
  readonly #config: GameConfig["boost"];
  readonly #listeners = new Set<BoostListener>();
  #cooldownRemaining = 0;
  readonly #cancelSlowMode: (() => void) | undefined;

  public constructor(
    ball: Pick<BallController, "fallSpeed">,
    gameState: Pick<GameStateController, "current">,
    wallet: Pick<RunWallet, "energy" | "spendEnergy">,
    config: GameConfig,
    cancelSlowMode?: () => void,
  ) {
    this.#cancelSlowMode = cancelSlowMode;
    this.#ball = ball;
    this.#gameState = gameState;
    this.#wallet = wallet;
    this.#config = config.boost;
  }

  public get energy(): number {
    return this.#wallet.energy;
  }

  public get energyCost(): number {
    const completedBands = Math.floor(
      Math.max(0, this.#ball.fallSpeed - this.#config.costBandSpeed) /
        this.#config.costBandSpeed,
    );
    return 1 + completedBands;
  }

  public get cooldownRemaining(): number {
    return this.#cooldownRemaining;
  }

  public get cooldownProgress(): number {
    return this.#cooldownRemaining / this.#config.cooldownSeconds;
  }

  public get canBoost(): boolean {
    return (
      this.#cooldownRemaining <= 0 &&
      (this.#gameState.current === GameState.Playing || this.#gameState.current === GameState.SlowMode && this.#cancelSlowMode !== undefined) &&
      this.#wallet.energy >= this.energyCost
    );
  }

  public onBoosted(listener: BoostListener): () => void {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  public tryBoost(): BoostResult {
    if (this.#gameState.current === GameState.SlowMode && this.#cancelSlowMode === undefined) {
      return { success: false, reason: "slow-mode" };
    }
    if (this.#gameState.current === GameState.BounceRecovery) {
      return { success: false, reason: "bounce-recovery" };
    }
    if (this.#gameState.current !== GameState.Playing && this.#gameState.current !== GameState.SlowMode) {
      return { success: false, reason: "game-not-playing" };
    }
    if (this.#cooldownRemaining > 0) {
      return { success: false, reason: "cooldown" };
    }

    const energyCost = this.energyCost;
    if (!this.#wallet.spendEnergy(energyCost)) {
      return { success: false, reason: "insufficient-energy" };
    }

    if (this.#gameState.current === GameState.SlowMode) this.#cancelSlowMode?.();
    const previousSpeed = this.#ball.fallSpeed;
    this.#ball.fallSpeed = previousSpeed * this.#config.speedMultiplier;
    this.#cooldownRemaining = this.#config.cooldownSeconds;

    const result: SuccessfulBoostResult = {
      success: true,
      previousSpeed,
      currentSpeed: this.#ball.fallSpeed,
      energyCost,
    };
    for (const listener of this.#listeners) {
      listener(result);
    }
    return result;
  }

  public fixedUpdate(fixedDeltaSeconds: number): void {
    const remaining = Math.max(0, this.#cooldownRemaining - fixedDeltaSeconds);
    this.#cooldownRemaining = remaining <= 1e-9 ? 0 : remaining;
  }
}
