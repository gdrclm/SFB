import type { GameConfig } from "../config/gameConfig";
import type { FixedSimulationSystem } from "../core/FixedStepRunner";
import type { HorizontalInput } from "../input/HorizontalInput";

interface BallTransform {
  readonly position: {
    x: number;
    y: number;
    z: number;
  };
}

export interface BallPosition {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

function moveTowards(current: number, target: number, maxDelta: number): number {
  if (Math.abs(target - current) <= maxDelta) {
    return target;
  }

  return current + Math.sign(target - current) * maxDelta;
}

export class BallController implements FixedSimulationSystem {
  readonly #transform: BallTransform;
  readonly #input: HorizontalInput;
  readonly #config: GameConfig["ball"];
  readonly #bounceConfig: GameConfig["unsuccessfulHit"];
  readonly #horizontalLimit: number;
  readonly #previousPosition = { x: 0, y: 0, z: 0 };
  #fallSpeed: number;
  #horizontalVelocity = 0;
  #bounceElapsedSeconds: number | null = null;

  public constructor(
    transform: BallTransform,
    input: HorizontalInput,
    config: GameConfig,
  ) {
    this.#transform = transform;
    this.#input = input;
    this.#config = config.ball;
    this.#bounceConfig = config.unsuccessfulHit;
    this.#fallSpeed = config.ball.startFallSpeed;
    this.#horizontalLimit = Math.max(0, config.playSpace.halfWidth - config.ball.radius);

    transform.position.x = config.ball.startPosition.x;
    transform.position.y = config.ball.startPosition.y;
    transform.position.z = config.playSpace.depth;
    this.#copyCurrentPositionToPrevious();
  }

  public get fallSpeed(): number {
    return this.#fallSpeed;
  }

  public set fallSpeed(value: number) {
    if (!Number.isFinite(value) || value < 0) {
      throw new RangeError("Fall speed must be a finite non-negative number.");
    }

    this.#fallSpeed = value;
  }

  public get horizontalVelocity(): number {
    return this.#horizontalVelocity;
  }

  public get isBouncing(): boolean {
    return this.#bounceElapsedSeconds !== null;
  }

  public get position(): BallPosition {
    return this.#transform.position;
  }

  public get previousPosition(): BallPosition {
    return this.#previousPosition;
  }

  public startBounce(contactY: number): boolean {
    if (this.isBouncing || !Number.isFinite(contactY)) {
      return false;
    }

    this.#transform.position.y = contactY;
    this.#copyCurrentPositionToPrevious();
    this.#fallSpeed = this.#config.startFallSpeed;
    this.#bounceElapsedSeconds = 0;
    return true;
  }

  public fixedUpdate(
    fixedDeltaSeconds: number,
    realFixedDeltaSeconds = fixedDeltaSeconds,
  ): void {
    this.#copyCurrentPositionToPrevious();
    this.#updateHorizontalVelocity(realFixedDeltaSeconds);

    const nextX =
      this.#transform.position.x +
      this.#horizontalVelocity * realFixedDeltaSeconds;
    const clampedX = Math.max(-this.#horizontalLimit, Math.min(this.#horizontalLimit, nextX));
    if (clampedX !== nextX) {
      this.#horizontalVelocity = 0;
    }

    this.#transform.position.x = clampedX;
    if (this.#bounceElapsedSeconds !== null) {
      this.#updateBounce(fixedDeltaSeconds);
      return;
    }

    this.#fallSpeed += this.#config.naturalAcceleration * fixedDeltaSeconds;
    this.#transform.position.y -=
      this.#fallSpeed * this.#config.movementScale * fixedDeltaSeconds;
  }

  #updateBounce(fixedDeltaSeconds: number): void {
    const elapsedSeconds = this.#bounceElapsedSeconds;
    if (elapsedSeconds === null) {
      return;
    }

    const duration = this.#bounceConfig.bounceDurationSeconds;
    const progress = Math.min(1, elapsedSeconds / duration);
    const upwardSpeed = this.#bounceConfig.bounceSpeed * (1 - progress);
    this.#transform.position.y +=
      upwardSpeed * this.#config.movementScale * fixedDeltaSeconds;
    const nextElapsedSeconds = elapsedSeconds + fixedDeltaSeconds;
    this.#bounceElapsedSeconds = nextElapsedSeconds;

    if (nextElapsedSeconds + Number.EPSILON >= duration) {
      this.#bounceElapsedSeconds = null;
      this.#fallSpeed = this.#config.startFallSpeed;
    }
  }

  #copyCurrentPositionToPrevious(): void {
    this.#previousPosition.x = this.#transform.position.x;
    this.#previousPosition.y = this.#transform.position.y;
    this.#previousPosition.z = this.#transform.position.z;
  }

  #updateHorizontalVelocity(fixedDeltaSeconds: number): void {
    if (this.#input.isActive) {
      const targetX = this.#input.normalizedPosition * this.#horizontalLimit;
      const desiredVelocity = Math.max(
        -this.#config.horizontalMaxSpeed,
        Math.min(
          this.#config.horizontalMaxSpeed,
          (targetX - this.#transform.position.x) * this.#config.horizontalFollowRate,
        ),
      );
      this.#horizontalVelocity = moveTowards(
        this.#horizontalVelocity,
        desiredVelocity,
        this.#config.horizontalAcceleration * fixedDeltaSeconds,
      );
      return;
    }

    this.#horizontalVelocity = moveTowards(
      this.#horizontalVelocity,
      0,
      this.#config.horizontalReleaseDamping * fixedDeltaSeconds,
    );
  }
}
