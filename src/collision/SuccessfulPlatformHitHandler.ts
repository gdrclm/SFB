import type { GameConfig } from "../config/gameConfig";
import type { PlatformController } from "../platform/PlatformController";
import type { PlatformPool } from "../platform/PlatformPool";
import type { PlatformCollision } from "./CollisionResolver";

export interface SuccessfulHitBall {
  fallSpeed: number;
}

export interface SuccessfulHitFeedback {
  playPlatformBreak(platform: PlatformController, onComplete: () => void): void;
  playBallReaction(): void;
  playCameraReaction(): void;
}

export class SuccessfulPlatformHitHandler {
  readonly #ball: SuccessfulHitBall;
  readonly #platformPool: Pick<PlatformPool, "beginRelease" | "completeRelease">;
  readonly #feedback: SuccessfulHitFeedback;
  readonly #speedLoss: number;

  public constructor(
    ball: SuccessfulHitBall,
    platformPool: Pick<PlatformPool, "beginRelease" | "completeRelease">,
    feedback: SuccessfulHitFeedback,
    config: GameConfig,
  ) {
    this.#ball = ball;
    this.#platformPool = platformPool;
    this.#feedback = feedback;
    this.#speedLoss = config.successfulHit.speedLoss;
  }

  public handle(collision: PlatformCollision): boolean {
    if (collision.assessment !== "sufficient" || !collision.platform.isActive) {
      return false;
    }

    if (!this.#platformPool.beginRelease(collision.platform)) {
      return false;
    }

    this.#feedback.playPlatformBreak(collision.platform, () => {
      this.#platformPool.completeRelease(collision.platform);
    });

    this.#ball.fallSpeed = collision.ballSpeed - this.#speedLoss;
    this.#feedback.playBallReaction();
    this.#feedback.playCameraReaction();
    return true;
  }
}
