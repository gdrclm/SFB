import type { GameConfig } from "../config/gameConfig";
import type { PlatformController } from "../platform/PlatformController";
import type { PlatformPool } from "../platform/PlatformPool";
import type { PlatformCollision } from "./CollisionResolver";

export interface SuccessfulHitBall {
  fallSpeed: number;
  startBreakImpact?(contactY: number, resistance: number): void;
}

export interface SuccessfulHitFeedback {
  playPlatformBreak(platform: PlatformController, onComplete: () => void, force?: number): void;
  playBallReaction(): void;
  playCameraReaction(force?: number): void;
}

export class SuccessfulPlatformHitHandler {
  readonly #ball: SuccessfulHitBall;
  readonly #platformPool: Pick<PlatformPool, "beginRelease" | "completeRelease">;
  readonly #feedback: SuccessfulHitFeedback;
  readonly #speedLoss: number;
  readonly #radius: number;

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
    this.#radius = config.ball.radius;
  }

  public handle(collision: PlatformCollision, powered = false): boolean {
    if ((!powered && collision.assessment !== "sufficient") || !collision.platform.isActive) {
      return false;
    }

    if (!this.#platformPool.beginRelease(collision.platform)) {
      return false;
    }

    const force = Math.max(.75, Math.min(1.6, collision.ballSpeed / Math.max(1, collision.platform.strength)));
    this.#feedback.playPlatformBreak(collision.platform, () => {
      this.#platformPool.completeRelease(collision.platform);
    }, force);

    if (!powered) this.#ball.fallSpeed = Math.max(0, collision.ballSpeed - this.#speedLoss);
    if (!powered) this.#ball.startBreakImpact?.(collision.platform.mesh.position.y + collision.platform.size.height / 2 + this.#radius,
      collision.platform.strength / Math.max(1, collision.ballSpeed));
    this.#feedback.playBallReaction();
    this.#feedback.playCameraReaction(force);
    return true;
  }
}
