import { breakResistance, speedAfterBreak } from "./BreakResistance";
import type { GameConfig } from "../config/gameConfig";
import type { PlatformController } from "../platform/PlatformController";
import type { PlatformPool } from "../platform/PlatformPool";
import type { PlatformCollision } from "./CollisionResolver";
import { breakFeedback, type BreakFeedback } from "../effects/BreakFeedback";

export interface SuccessfulHitBall {
  fallSpeed: number;
  readonly breakFlow?:number;
  readonly powerBreakSeconds?:number;
  recordBreak?(resistance:number):void;
  startBreakImpact?(contactY: number, resistance: number, contactX?: number, holdSeconds?: number): void;
}

export interface SuccessfulHitFeedback {
  playPlatformBreak(platform: PlatformController, onComplete: () => void, force?: number, fallSpeed?:number,power?:boolean, feedback?: BreakFeedback): void;
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
  readonly #reducedMotion: boolean;
  #perfectCooldown = 0;
  #lastFeedback: BreakFeedback | null = null;

  public get lastFeedback(): BreakFeedback | null { return this.#lastFeedback; }

  public fixedUpdate(delta: number, realDelta = delta): void {
    this.#perfectCooldown = Math.max(0, this.#perfectCooldown - realDelta);
  }

  public constructor(
    ball: SuccessfulHitBall,
    platformPool: Pick<PlatformPool, "beginRelease" | "completeRelease">,
    feedback: SuccessfulHitFeedback,
    config: GameConfig,
    reducedMotion = false,
  ) {
    this.#ball = ball;
    this.#platformPool = platformPool;
    this.#feedback = feedback;
    this.#maximumSpeedLossFraction = config.successfulHit.maximumSpeedLossFraction;
    this.#maximumSpeedLoss = config.successfulHit.maximumSpeedLoss;
    this.#radius = config.ball.radius;
    this.#reducedMotion = reducedMotion;
  }

  public handle(collision: PlatformCollision, powered = false): boolean {
    if ((!powered && collision.assessment !== "sufficient") || !collision.platform.isActive) {
      return false;
    }

    if (!this.#platformPool.beginRelease(collision.platform)) {
      return false;
    }

    const flow=powered?0:this.#ball.breakFlow??0;
    if(!powered)this.#ball.recordBreak?.(breakResistance(collision.ballSpeed,collision.platform.strength));
    const chainPower = !powered && (this.#ball.powerBreakSeconds ?? 0) > 0;
    const feedback = breakFeedback(collision.ballSpeed, collision.platform.strength,
      !powered && !chainPower && !this.#reducedMotion && this.#perfectCooldown <= 0);
    this.#lastFeedback = feedback;
    if (feedback.perfect) this.#perfectCooldown = .65;
    const force = feedback.force;
    if (!powered) this.#ball.fallSpeed = speedAfterBreak(collision.ballSpeed, collision.platform.strength, this.#maximumSpeedLossFraction, this.#maximumSpeedLoss,flow);
    if (!powered && this.#ball.startBreakImpact) {
      const contactY = collision.contact?.y ?? collision.platform.mesh.position.y + collision.platform.size.height / 2 + this.#radius;
      const resistance = breakResistance(collision.ballSpeed, collision.platform.strength) * (1 - flow * .5);
      if (feedback.perfect) this.#ball.startBreakImpact(contactY, resistance, collision.contact?.x, feedback.holdSeconds);
      else this.#ball.startBreakImpact(contactY, resistance, collision.contact?.x);
    }
    this.#feedback.playPlatformBreak(collision.platform, () => {
      this.#platformPool.completeRelease(collision.platform);
    }, force, collision.ballSpeed, chainPower, feedback);
    this.#feedback.playBallReaction();
    this.#feedback.playCameraReaction(force);
    return true;
  }
}
