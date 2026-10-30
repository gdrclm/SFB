import { breakResistance, speedAfterBreak } from "./BreakResistance";
import type { GameConfig } from "../config/gameConfig";
import type { PlatformController } from "../platform/PlatformController";
import type { PlatformPool } from "../platform/PlatformPool";
import type { PlatformCollision } from "./CollisionResolver";

export interface SuccessfulHitBall {
  fallSpeed: number;
  readonly breakFlow?:number;
  readonly powerBreakSeconds?:number;
  recordBreak?(resistance:number):void;
  startBreakImpact?(contactY: number, resistance: number, contactX?: number): void;
}

export interface SuccessfulHitFeedback {
  playPlatformBreak(platform: PlatformController, onComplete: () => void, force?: number, fallSpeed?:number,power?:boolean): void;
  playBallReaction(): void;
  playCameraReaction(force?: number): void;
}

export class SuccessfulPlatformHitHandler {
  readonly #ball: SuccessfulHitBall;
  readonly #platformPool: Pick<PlatformPool, "beginRelease" | "completeRelease">;
  readonly #feedback: SuccessfulHitFeedback;
  readonly #maximumSpeedLossFraction: number;
  readonly #maximumSpeedLoss: number;
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
    this.#maximumSpeedLossFraction = config.successfulHit.maximumSpeedLossFraction;
    this.#maximumSpeedLoss = config.successfulHit.maximumSpeedLoss;
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
    const flow=powered?0:this.#ball.breakFlow??0;
    if (!powered) this.#ball.fallSpeed = speedAfterBreak(collision.ballSpeed, collision.platform.strength, this.#maximumSpeedLossFraction, this.#maximumSpeedLoss,flow);
    if (!powered) this.#ball.startBreakImpact?.(collision.contact?.y ?? collision.platform.mesh.position.y + collision.platform.size.height / 2 + this.#radius,
      breakResistance(collision.ballSpeed, collision.platform.strength)*(1-flow*.5), collision.contact?.x);
    if(!powered)this.#ball.recordBreak?.(breakResistance(collision.ballSpeed,collision.platform.strength));
    this.#feedback.playPlatformBreak(collision.platform, () => {
      this.#platformPool.completeRelease(collision.platform);
    }, force, collision.ballSpeed,!powered&&(this.#ball.powerBreakSeconds??0)>0);
    this.#feedback.playBallReaction();
    this.#feedback.playCameraReaction(force);
    return true;
  }
}
