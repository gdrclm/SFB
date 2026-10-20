import type { GameConfig } from "../config/gameConfig";
import type { FixedSimulationSystem } from "../core/FixedStepRunner";

interface CameraProjection {
  orthoTop: number | null;
  orthoBottom: number | null;
  orthoLeft: number | null;
  orthoRight: number | null;
}

interface CameraRig {
  readonly position: {
    y: number;
  };
}

interface CameraTarget {
  readonly position: {
    y: number;
  };
  readonly fallSpeed: number;
}

export type CameraBehavior = "gameplay" | "phase-transition";

function smoothFactor(sharpness: number, deltaSeconds: number): number {
  return 1 - Math.exp(-sharpness * deltaSeconds);
}

function lerp(start: number, end: number, amount: number): number {
  return start + (end - start) * amount;
}

export function calculateCameraSize(
  speed: number,
  config: GameConfig["camera"],
): number {
  const speedRatio = Math.max(1, speed / config.speedThreshold);
  return config.orthographicSize * speedRatio ** config.speedZoomExponent;
}

export class CameraController implements FixedSimulationSystem {
  readonly #camera: CameraProjection;
  readonly #rig: CameraRig;
  readonly #target: CameraTarget;
  readonly #getAspectRatio: () => number;
  readonly #config: GameConfig["camera"];
  readonly #playSpaceHalfWidth: number;
  #behavior: CameraBehavior = "gameplay";
  #baseOrthographicSize: number;
  #boostZoomOffset = 0;
  #boostStartZoomOffset = 0;
  #boostZoomElapsedSeconds: number | null = null;

  public constructor(
    camera: CameraProjection,
    rig: CameraRig,
    target: CameraTarget,
    getAspectRatio: () => number,
    config: GameConfig,
  ) {
    this.#camera = camera;
    this.#rig = rig;
    this.#target = target;
    this.#getAspectRatio = getAspectRatio;
    this.#config = config.camera;
    this.#playSpaceHalfWidth = config.playSpace.halfWidth;
    this.#baseOrthographicSize = calculateCameraSize(
      target.fallSpeed,
      this.#config,
    );
    this.#rig.position.y = target.position.y;
    this.resizeViewport();
  }

  public get behavior(): CameraBehavior {
    return this.#behavior;
  }

  public get orthographicSize(): number {
    return this.#baseOrthographicSize + this.#boostZoomOffset;
  }

  public setPhaseTransitionActive(active: boolean): void {
    this.#behavior = active ? "phase-transition" : "gameplay";
  }

  public playBoostReaction(): void {
    this.#boostStartZoomOffset = this.#boostZoomOffset;
    this.#boostZoomElapsedSeconds = 0;
    this.resizeViewport();
  }

  public fixedUpdate(
    fixedDeltaSeconds: number,
    realFixedDeltaSeconds = fixedDeltaSeconds,
  ): void {
    const followAmount = smoothFactor(this.#config.followSharpness, fixedDeltaSeconds);
    const targetY = this.#target.position.y;
    const smoothedY = lerp(this.#rig.position.y, targetY, followAmount);
    const maximumTargetOffset =
      this.#getVisibleVerticalHalfSize() * this.#config.safeVerticalRatio;
    this.#rig.position.y = Math.max(
      targetY - maximumTargetOffset,
      Math.min(targetY + maximumTargetOffset, smoothedY),
    );

    const transitionSize =
      this.#behavior === "phase-transition"
        ? this.#config.phaseTransitionExtraSize
        : 0;
    const targetSize =
      calculateCameraSize(this.#target.fallSpeed, this.#config) + transitionSize;
    const zoomAmount = smoothFactor(this.#config.zoomSharpness, fixedDeltaSeconds);
    const boostDelay = this.#boostZoomElapsedSeconds !== null && this.#boostZoomElapsedSeconds < this.#config.boostZoomDelaySeconds;
    if (!boostDelay) this.#baseOrthographicSize = lerp(this.#baseOrthographicSize, targetSize, zoomAmount);
    this.#updateBoostZoom(realFixedDeltaSeconds);
    this.resizeViewport();
  }

  public resizeViewport(): void {
    const aspectRatio = Math.max(this.#getAspectRatio(), Number.EPSILON);
    const verticalHalfSize = this.#getVisibleVerticalHalfSize(aspectRatio);
    this.#camera.orthoTop = verticalHalfSize;
    this.#camera.orthoBottom = -verticalHalfSize;
    this.#camera.orthoLeft = -verticalHalfSize * aspectRatio;
    this.#camera.orthoRight = verticalHalfSize * aspectRatio;
  }

  #getVisibleVerticalHalfSize(
    aspectRatio = Math.max(this.#getAspectRatio(), Number.EPSILON),
  ): number {
    return (
      Math.max(
        this.#config.orthographicSize,
        this.#playSpaceHalfWidth / aspectRatio,
      ) * (this.#baseOrthographicSize / this.#config.orthographicSize) + this.#boostZoomOffset
    );
  }

  #updateBoostZoom(realFixedDeltaSeconds: number): void {
    const elapsedSeconds = this.#boostZoomElapsedSeconds;
    if (elapsedSeconds === null) {
      return;
    }

    const nextElapsedSeconds = elapsedSeconds + realFixedDeltaSeconds;
    const activeElapsed = Math.max(0, nextElapsedSeconds - this.#config.boostZoomDelaySeconds);
    const progress = Math.min(1, activeElapsed / this.#config.boostZoomReturnSeconds);
    const smoothProgress = progress * progress * (3 - 2 * progress);
    const attack = Math.min(1, activeElapsed / .14);
    this.#boostZoomOffset = lerp(this.#boostStartZoomOffset, this.#config.boostZoomExtraSize, attack) * (1 - smoothProgress);
    this.#boostZoomElapsedSeconds = nextElapsedSeconds;
    if (progress >= 1) { this.#boostZoomOffset = 0; this.#boostZoomElapsedSeconds = null; }
  }
}
