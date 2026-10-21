import type { BallController } from "../ball/BallController";
import type { GameConfig } from "../config/gameConfig";
import type { FixedSimulationSystem } from "../core/FixedStepRunner";
import { GameState, type GameStateController } from "../core/GameStateController";
import type { PlatformController } from "../platform/PlatformController";
import type { LifeCounter } from "../run/LifeCounter";
import type { PlatformCollision } from "./CollisionResolver";

export interface UnsuccessfulHitFeedback {
  playErrorReaction(platform: PlatformController): void;
}

export class UnsuccessfulPlatformHitHandler implements FixedSimulationSystem {
  readonly #ball: Pick<BallController, "isBouncing" | "startBounce">;
  readonly #gameState: Pick<GameStateController, "current" | "transitionTo">;
  readonly #lives: Pick<LifeCounter, "loseLife" | "remainingLives">;
  readonly #feedback: UnsuccessfulHitFeedback;
  readonly #ballRadius: number;
  readonly #repeatProtectionSeconds: number;
  #protectionRemainingSeconds = 0;
  readonly #damagedActivations = new WeakMap<PlatformController, number>();

  public constructor(
    ball: Pick<BallController, "isBouncing" | "startBounce">,
    gameState: Pick<GameStateController, "current" | "transitionTo">,
    lives: Pick<LifeCounter, "loseLife" | "remainingLives">,
    feedback: UnsuccessfulHitFeedback,
    config: GameConfig,
  ) {
    this.#ball = ball;
    this.#gameState = gameState;
    this.#lives = lives;
    this.#feedback = feedback;
    this.#ballRadius = config.ball.radius;
    this.#repeatProtectionSeconds = config.unsuccessfulHit.repeatProtectionSeconds;
  }

  public get protectionRemainingSeconds(): number {
    return this.#protectionRemainingSeconds;
  }

  public handle(collision: PlatformCollision): boolean {
    if (
      collision.assessment !== "insufficient" ||
      (this.#gameState.current !== GameState.Playing &&
        this.#gameState.current !== GameState.SlowMode) ||
      this.#protectionRemainingSeconds > 0 ||
      this.#ball.isBouncing
    ) {
      return false;
    }

    const contactY =
      collision.platform.mesh.position.y +
      collision.platform.size.height / 2 +
      this.#ballRadius;
    // A surviving obstacle remains solid; subsequent contacts rebound without another life charge.
    if (this.#damagedActivations.get(collision.platform) === collision.platform.activationId) {
      if (this.#ball.startBounce(contactY)) {
        this.#gameState.transitionTo(GameState.BounceRecovery);
        this.#feedback.playErrorReaction(collision.platform);
      }
      return false;
    }
    if (!this.#ball.startBounce(contactY) || !this.#lives.loseLife()) {
      return false;
    }

    this.#protectionRemainingSeconds = this.#repeatProtectionSeconds;
    this.#damagedActivations.set(collision.platform, collision.platform.activationId);
    this.#gameState.transitionTo(
      this.#lives.remainingLives === 0
        ? GameState.GameOver
        : GameState.BounceRecovery,
    );
    this.#feedback.playErrorReaction(collision.platform);
    return true;
  }

  public fixedUpdate(fixedDeltaSeconds: number): void {
    this.#protectionRemainingSeconds = Math.max(
      0,
      this.#protectionRemainingSeconds - fixedDeltaSeconds,
    );

    if (
      this.#gameState.current === GameState.BounceRecovery &&
      !this.#ball.isBouncing
    ) {
      this.#gameState.transitionTo(GameState.Playing);
    }
  }
}
