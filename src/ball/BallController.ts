import { breakImpactProfile } from "../collision/BreakResistance";
import type { GameConfig } from "../config/gameConfig";
import type { FixedSimulationSystem } from "../core/FixedStepRunner";
import type { HorizontalInput } from "../input/HorizontalInput";
import { steeringPrecisionBlend, steeringWidthScale } from "../input/SteeringResponse";

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
  #horizontalLimit: number;
  readonly #baseHorizontalLimit: number;
  readonly #previousPosition = { x: 0, y: 0, z: 0 };
  #fallSpeed: number;
  #horizontalVelocity = 0;
  #bounceElapsedSeconds: number | null = null;
  #bounceContactY = 0;
  #bounceLaunchSpeed = 0;
  #bounceRecoverySpeed = 0;
  readonly #impactRetention: number;
  #breakElapsed: number | null = null;
  #breakHold = .04;
  #breakRecovery = .12;
  #breakTransmission = 0;
  #verticalVelocity = 0;
  #lateralImpulse = 0;
  #impulseRemaining = 0;
  #impulseDuration = 1;
  #lateralDrift = 0;
  #wasInputActive = false;
  #encounterTravelScale = 1;
  public setEncounterTravelScale(scale: number): void {
    this.#encounterTravelScale=Number.isFinite(scale)?Math.max(.01,Math.min(1,scale)):1;
  }

  public applyLateralImpulse(velocity: number, duration = .4): void {
    if (!Number.isFinite(velocity) || !Number.isFinite(duration) || duration <= 0) return;
    this.#lateralImpulse = Math.max(-8, Math.min(8, velocity));
    this.#impulseDuration = Math.min(.8, duration);
    this.#impulseRemaining = this.#impulseDuration;
  }

  public get verticalVelocity(): number { return this.#verticalVelocity; }
  public get impactCompression(): number {
    if (this.#bounceElapsedSeconds !== null) return this.#bounceElapsedSeconds < .045 ? 1 : 0;
    return this.#breakElapsed !== null && this.#breakElapsed < this.#breakHold ? 1 : 0;
  }
  public startBreakImpact(contactY: number, resistance: number, contactX?: number): void {
    if (!Number.isFinite(contactY) || this.isBouncing) return;
    this.#transform.position.y = contactY;
    if (contactX !== undefined) this.#transform.position.x = contactX;
    this.#breakElapsed = 0;
    const impact = breakImpactProfile(resistance);
    this.#breakHold = impact.hold;
    this.#breakRecovery = impact.recovery;
    this.#breakTransmission = impact.minimumTransmission;
    this.#verticalVelocity = -this.#fallSpeed * this.#config.movementScale * this.#breakTransmission * this.#encounterTravelScale;
  }

  public constructor(
    transform: BallTransform,
    input: HorizontalInput,
    config: GameConfig,
  ) {
    this.#transform = transform;
    this.#input = input;
    this.#config = config.ball;
    this.#bounceConfig = config.unsuccessfulHit;
    this.#impactRetention = config.powers.impactRetention;
    this.#fallSpeed = config.ball.startFallSpeed;
    this.#horizontalLimit = Math.max(0, config.playSpace.halfWidth - config.ball.radius);
    this.#baseHorizontalLimit = Math.max(.001, this.#horizontalLimit);

    transform.position.x = config.ball.startPosition.x;
    transform.position.y = config.ball.startPosition.y;
    transform.position.z = config.playSpace.depth;
    this.#copyCurrentPositionToPrevious();
    // A fresh swipe is anchored at the already-displaced ball position.
    if(this.#input.isActive && !this.#wasInputActive)this.#lateralDrift=0;
    this.#wasInputActive=this.#input.isActive;
  }

  public get horizontalLimit(): number { return this.#horizontalLimit; }

  public setPlayfieldHalfWidth(halfWidth: number): void {
    if (!Number.isFinite(halfWidth) || halfWidth <= this.#config.radius) return;
    this.#horizontalLimit = halfWidth - this.#config.radius;
    this.#transform.position.x = Math.max(-this.#horizontalLimit, Math.min(this.#horizontalLimit, this.#transform.position.x));
  }

  public get fallSpeed(): number {
    return this.#fallSpeed;
  }

  public set fallSpeed(value: number) {
    if (!Number.isFinite(value) || value < 0) {
      throw new RangeError("Fall speed must be a finite non-negative number.");
    }

    this.#fallSpeed = value;
    if (this.#bounceElapsedSeconds !== null) this.#bounceRecoverySpeed = value;
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

  public startBounce(contactY: number, contactX?: number): boolean {
    if (this.isBouncing || !Number.isFinite(contactY)) {
      return false;
    }

    this.#bounceLaunchSpeed = Math.max(6, Math.min(10, this.#bounceConfig.bounceSpeed * this.#config.movementScale * 2 + this.#fallSpeed * this.#config.movementScale * .24));
    this.#bounceContactY = contactY;
    this.#breakElapsed = null;
    this.#verticalVelocity = 0;
    this.#transform.position.y = contactY;
    if (contactX !== undefined) this.#transform.position.x = contactX;
    this.#bounceRecoverySpeed = this.#config.startFallSpeed + Math.max(0, this.#fallSpeed - this.#config.startFallSpeed) * this.#impactRetention;
    this.#fallSpeed = this.#bounceRecoverySpeed;
    this.#bounceElapsedSeconds = 0;
    return true;
  }

  public fixedUpdate(
    fixedDeltaSeconds: number,
    realFixedDeltaSeconds = fixedDeltaSeconds,
  ): void {
    this.#copyCurrentPositionToPrevious();
    const previousDrift=this.#lateralDrift;
    const gustActive=this.#impulseRemaining>0;
    if(gustActive) {
      const dt=Math.min(fixedDeltaSeconds,this.#impulseRemaining);
      const average=(this.#impulseRemaining-dt/2)/this.#impulseDuration;
      this.#lateralDrift=Math.max(-1.5,Math.min(1.5,this.#lateralDrift+this.#lateralImpulse*average*dt));
      this.#impulseRemaining=Math.max(0,this.#impulseRemaining-dt);
    } else this.#lateralDrift*=Math.exp(-6*fixedDeltaSeconds);
    if (this.#input.isImmediate) {
      if (this.#input.isActive) {
        const targetX = Math.max(-this.#horizontalLimit,Math.min(this.#horizontalLimit,
          Math.max(-1, Math.min(1, this.#input.normalizedPosition)) * this.#horizontalLimit+this.#lateralDrift));
        // Retain the original opening response even on wide screens. Compensate
        // for the expanded field only after the ball has substantially sped up.
        const widthScale = steeringWidthScale(this.#horizontalLimit / this.#baseHorizontalLimit,
          this.#fallSpeed, this.#config.startFallSpeed);
        const effort = this.#input.steeringEffort;
        const gestureScale = effort === undefined ? 1 : .85 + 2.65 * Math.max(0, Math.min(1, effort));
        const maxSpeed = this.#config.horizontalMaxSpeed * widthScale * gestureScale;
        const step = maxSpeed * realFixedDeltaSeconds;
        const fineStep = Math.min(step, Math.abs(targetX - this.#transform.position.x) * (1 - Math.exp(-24 * realFixedDeltaSeconds)));
        const precision = effort === undefined ? steeringPrecisionBlend(this.#fallSpeed, this.#config.startFallSpeed) : 1;
        this.#transform.position.x = moveTowards(this.#transform.position.x, targetX, step + (fineStep - step) * precision);
      }
    } else {
      this.#updateHorizontalVelocity(realFixedDeltaSeconds);
      const nextX = this.#transform.position.x + this.#horizontalVelocity * realFixedDeltaSeconds;
      const clampedX = Math.max(-this.#horizontalLimit, Math.min(this.#horizontalLimit, nextX));
      if (clampedX !== nextX) this.#horizontalVelocity = 0;
      this.#transform.position.x = clampedX;
    }
    if (gustActive && !this.#input.isActive) {
      this.#transform.position.x = Math.max(-this.#horizontalLimit, Math.min(this.#horizontalLimit,
        this.#transform.position.x + this.#lateralDrift-previousDrift));
    }
    if (this.#input.isImmediate) this.#horizontalVelocity = (this.#transform.position.x - this.#previousPosition.x) / Math.max(.0001, realFixedDeltaSeconds);
    if (this.#bounceElapsedSeconds !== null) {
      this.#updateBounce(fixedDeltaSeconds);
      return;
    }

    this.#fallSpeed += this.#config.naturalAcceleration * fixedDeltaSeconds;
    let transmission = 1;
    if (this.#breakElapsed !== null) {
      this.#breakElapsed += fixedDeltaSeconds;
      const t = Math.max(0, (this.#breakElapsed - this.#breakHold) / this.#breakRecovery);
      transmission = t >= 1 ? 1 : this.#breakTransmission + (1 - this.#breakTransmission) * t * t * (3 - 2 * t);
      if (t >= 1) this.#breakElapsed = null;
    }
    this.#verticalVelocity = transmission === 0 ? 0 : -this.#fallSpeed * this.#config.movementScale * transmission * this.#encounterTravelScale;
    this.#transform.position.y += this.#verticalVelocity * fixedDeltaSeconds;
  }

  #updateBounce(fixedDeltaSeconds: number): void {
    const elapsedSeconds = this.#bounceElapsedSeconds;
    if (elapsedSeconds === null) {
      return;
    }

    const duration = this.#bounceConfig.bounceDurationSeconds;
    const hold = .045;
    const nextElapsed = Math.min(duration, elapsedSeconds + fixedDeltaSeconds);
    this.#bounceElapsedSeconds = nextElapsed;
    const flight = Math.max(0, nextElapsed - hold);
    // Match the downward velocity to ordinary falling at the end of recovery.
    const gravity = (this.#bounceLaunchSpeed + this.#bounceRecoverySpeed * this.#config.movementScale) / (duration - hold);
    this.#transform.position.y = this.#bounceContactY + this.#bounceLaunchSpeed * flight - .5 * gravity * flight * flight;
    this.#verticalVelocity = flight === 0 ? 0 : this.#bounceLaunchSpeed - gravity * flight;
    if (nextElapsed + Number.EPSILON >= duration) {
      this.#bounceElapsedSeconds = null;
      this.#fallSpeed = this.#bounceRecoverySpeed;
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
