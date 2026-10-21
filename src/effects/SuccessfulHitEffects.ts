import type { Camera } from "@babylonjs/core/Cameras/camera";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import type { SuccessfulHitFeedback } from "../collision/SuccessfulPlatformHitHandler";
import type { GameConfig } from "../config/gameConfig";
import type { FixedSimulationSystem } from "../core/FixedStepRunner";
import type { PlatformController } from "../platform/PlatformController";

interface PlatformBreakState {
  readonly platform: Pick<PlatformController, "renderBreak">;
  readonly onComplete: () => void;
  elapsedSeconds: number;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function lerp(start: number, end: number, amount: number): number {
  return start + (end - start) * clamp01(amount);
}

function copyLerp(target: Vector3, start: Vector3, end: Vector3, amount: number): void {
  target.set(lerp(start.x, end.x, amount), lerp(start.y, end.y, amount), lerp(start.z, end.z, amount));
}

export class SuccessfulHitEffects implements SuccessfulHitFeedback, FixedSimulationSystem {
  readonly #ball: AbstractMesh;
  readonly #camera: Camera;
  readonly #config: GameConfig["successfulHit"];
  readonly #platformBreaks = new Set<PlatformBreakState>();
  readonly #ballBaseScale: Vector3;
  readonly #avatarManaged: boolean;
  #ballReactionElapsedSeconds: number | null = null;
  #cameraReactionElapsedSeconds: number | null = null;
  #cameraBasePosition: Vector3;
  #cameraForce = 1;

  public constructor(ball: AbstractMesh, camera: Camera, config: GameConfig) {
    this.#ball = ball;
    this.#avatarManaged = (ball.metadata as { avatarManaged?: boolean } | null)?.avatarManaged === true;
    this.#camera = camera;
    this.#config = config.successfulHit;
    this.#ballBaseScale = ball.scaling.clone();
    this.#cameraBasePosition = camera.position.clone();
  }

  public playPlatformBreak(platform: Pick<PlatformController, "renderBreak">, onComplete: () => void): void {
    platform.renderBreak(0);
    this.#platformBreaks.add({ platform, onComplete, elapsedSeconds: 0 });
  }

  public playBallReaction(): void {
    if (this.#avatarManaged) return;
    this.#ball.scaling.copyFrom(this.#ballBaseScale);
    this.#ballReactionElapsedSeconds = 0;
  }

  public playCameraReaction(force = 1): void {
    if (this.#cameraReactionElapsedSeconds === null) this.#cameraBasePosition = this.#camera.position.clone();
    this.#cameraForce = Math.max(.75, Math.min(1.6, force));
    this.#cameraReactionElapsedSeconds = 0;
  }

  public fixedUpdate(fixedDeltaSeconds: number, realDeltaSeconds = fixedDeltaSeconds): void {
    this.#updatePlatformBreaks(realDeltaSeconds);
    this.#updateBallReaction(fixedDeltaSeconds);
    this.#updateCameraReaction(fixedDeltaSeconds);
  }

  public dispose(): void {
    for (const state of this.#platformBreaks) state.platform.renderBreak(1);
    this.#platformBreaks.clear();
    if (!this.#avatarManaged) this.#ball.scaling.copyFrom(this.#ballBaseScale);
    this.#camera.position.copyFrom(this.#cameraBasePosition);
    this.#ballReactionElapsedSeconds = null;
    this.#cameraReactionElapsedSeconds = null;
  }

  #updatePlatformBreaks(realDeltaSeconds: number): void {
    for (const state of this.#platformBreaks) {
      state.elapsedSeconds += realDeltaSeconds;
      const progress = clamp01(state.elapsedSeconds / this.#config.platformEffectSeconds);
      state.platform.renderBreak(progress);
      if (progress >= 1) {
        this.#platformBreaks.delete(state);
        state.onComplete();
      }
    }
  }

  #updateBallReaction(fixedDeltaSeconds: number): void {
    if (this.#ballReactionElapsedSeconds === null) {
      return;
    }

    this.#ballReactionElapsedSeconds += fixedDeltaSeconds;
    const progress = clamp01(
      this.#ballReactionElapsedSeconds / this.#config.ballEffectSeconds,
    );
    const stretch = this.#config.ballVerticalStretch;
    const squeeze = 1 / Math.sqrt(stretch);
    const peakScale = new Vector3(
      this.#ballBaseScale.x * squeeze,
      this.#ballBaseScale.y * stretch,
      this.#ballBaseScale.z * squeeze,
    );

    if (progress <= 0.35) {
      copyLerp(
        this.#ball.scaling,
        this.#ballBaseScale,
        peakScale,
        progress / 0.35,
      );
    } else {
      copyLerp(
        this.#ball.scaling,
        peakScale,
        this.#ballBaseScale,
        (progress - 0.35) / 0.65,
      );
    }

    if (progress >= 1) {
      this.#ball.scaling.copyFrom(this.#ballBaseScale);
      this.#ballReactionElapsedSeconds = null;
    }
  }

  #updateCameraReaction(fixedDeltaSeconds: number): void {
    if (this.#cameraReactionElapsedSeconds === null) {
      return;
    }

    this.#cameraReactionElapsedSeconds += fixedDeltaSeconds;
    const progress = clamp01(
      this.#cameraReactionElapsedSeconds / this.#config.cameraEffectSeconds,
    );
    const impulse = this.#config.cameraImpulse * this.#cameraForce;
    let verticalOffset: number;

    if (progress <= 0.25) {
      verticalOffset = lerp(0, -impulse, progress / 0.25);
    } else if (progress <= 0.55) {
      verticalOffset = lerp(-impulse, impulse * 0.45, (progress - 0.25) / 0.3);
    } else {
      verticalOffset = lerp(impulse * 0.45, 0, (progress - 0.55) / 0.45);
    }

    this.#camera.position.copyFrom(this.#cameraBasePosition);
    this.#camera.position.y += verticalOffset;

    if (progress >= 1) {
      this.#camera.position.copyFrom(this.#cameraBasePosition);
      this.#cameraReactionElapsedSeconds = null;
    }
  }

}
