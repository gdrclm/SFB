import type { BallPosition } from "../ball/BallController";
import type { FixedSimulationSystem } from "../core/FixedStepRunner";
import type { PlatformController } from "../platform/PlatformController";

export interface CollisionBallState {
  readonly fallSpeed: number;
  readonly position: BallPosition;
  readonly previousPosition: BallPosition;
}

export interface PlatformSweep {
  cast(start: BallPosition, end: BallPosition): PlatformController | null;
  dispose(): void;
}

export type PlatformHitAssessment = "sufficient" | "insufficient";

export interface PlatformCollision {
  readonly platform: PlatformController;
  readonly ballSpeed: number;
  readonly assessment: PlatformHitAssessment;
}

export type PlatformCollisionListener = (collision: PlatformCollision) => void;

export function assessPlatformHit(
  ballSpeed: number,
  platformStrength: number,
): PlatformHitAssessment {
  return ballSpeed >= platformStrength ? "sufficient" : "insufficient";
}

export class CollisionResolver implements FixedSimulationSystem {
  readonly #ball: CollisionBallState;
  readonly #sweep: PlatformSweep;
  readonly #listeners = new Set<PlatformCollisionListener>();
  readonly #reportedActivations = new Map<PlatformController, number>();

  public constructor(ball: CollisionBallState, sweep: PlatformSweep) {
    this.#ball = ball;
    this.#sweep = sweep;
  }

  public onCollision(listener: PlatformCollisionListener): () => void {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  public fixedUpdate(): void {
    const platform = this.#sweep.cast(this.#ball.previousPosition, this.#ball.position);
    if (platform === null) {
      this.#reportedActivations.clear();
      return;
    }

    if (
      this.#reportedActivations.get(platform) === platform.activationId
    ) {
      return;
    }

    this.#reportedActivations.set(platform, platform.activationId);
    const collision: PlatformCollision = {
      platform,
      ballSpeed: this.#ball.fallSpeed,
      assessment: assessPlatformHit(this.#ball.fallSpeed, platform.strength),
    };
    for (const listener of this.#listeners) {
      listener(collision);
    }
  }

  public dispose(): void {
    this.#listeners.clear();
    this.#reportedActivations.clear();
    this.#sweep.dispose();
  }
}
