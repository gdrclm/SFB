import type { Camera } from "@babylonjs/core/Cameras/camera";
import type { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import type { GameConfig } from "../config/gameConfig";
import type { FixedSimulationSystem } from "../core/FixedStepRunner";
import type { PlatformController } from "../platform/PlatformController";
import type { UnsuccessfulHitFeedback } from "../collision/UnsuccessfulPlatformHitHandler";

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function lerp(start: number, end: number, amount: number): number {
  return start + (end - start) * clamp01(amount);
}

export class UnsuccessfulHitEffects
  implements UnsuccessfulHitFeedback, FixedSimulationSystem
{
  readonly #ball: AbstractMesh;
  readonly #camera: Camera;
  readonly #config: GameConfig["unsuccessfulHit"];
  readonly #ballBaseScale: Vector3;
  readonly #avatarManaged: boolean;
  #platform: AbstractMesh | null = null;
  #platformBaseVisibility = 1;
  #cameraBasePosition: Vector3;
  #elapsedSeconds: number | null = null;

  public constructor(ball: AbstractMesh, camera: Camera, config: GameConfig) {
    this.#ball = ball;
    this.#avatarManaged = (ball.metadata as { avatarManaged?: boolean } | null)?.avatarManaged === true;
    this.#camera = camera;
    this.#config = config.unsuccessfulHit;
    this.#ballBaseScale = ball.scaling.clone();
    this.#cameraBasePosition = camera.position.clone();
  }

  public playErrorReaction(platform: Pick<PlatformController, "mesh"> & Partial<Pick<PlatformController, "playImpact">>): void {
    platform.playImpact?.(1.4,this.#ball.position.x);
    this.#resetVisuals();
    this.#platform = platform.mesh;
    this.#platformBaseVisibility = platform.mesh.visibility;
    this.#cameraBasePosition = this.#camera.position.clone();
    this.#elapsedSeconds = 0;
  }

  public fixedUpdate(fixedDeltaSeconds: number): void {
    if (this.#elapsedSeconds === null) {
      return;
    }

    this.#elapsedSeconds += fixedDeltaSeconds;
    const progress = clamp01(this.#elapsedSeconds / this.#config.feedbackSeconds);
    const squashProgress =
      progress <= 0.22 ? progress / 0.22 : 1 - (progress - 0.22) / 0.78;
    const verticalScale = lerp(1, this.#config.ballSquash, squashProgress);
    const horizontalScale = 1 / Math.sqrt(verticalScale);
    if (!this.#avatarManaged) this.#ball.scaling.set(
      this.#ballBaseScale.x * horizontalScale,
      this.#ballBaseScale.y * verticalScale,
      this.#ballBaseScale.z * horizontalScale,
    );

    if (this.#platform !== null) {
      const pulse = Math.abs(Math.sin(progress * Math.PI * 6));
      this.#platform.visibility = lerp(
        this.#platformBaseVisibility,
        this.#platformBaseVisibility * 0.35,
        pulse * (1 - progress),
      );
    }

    this.#camera.position.copyFrom(this.#cameraBasePosition);
    this.#camera.position.y -= Math.sin(progress * Math.PI) * this.#config.cameraImpulse * 1.8 * (1 - progress);
    this.#camera.position.x +=
      Math.sin(progress * Math.PI * 8) *
      this.#config.cameraImpulse *
      (1 - progress);

    if (progress >= 1) {
      this.#resetVisuals();
      this.#elapsedSeconds = null;
    }
  }

  public dispose(): void {
    this.#resetVisuals();
    this.#elapsedSeconds = null;
    this.#platform = null;
  }

  #resetVisuals(): void {
    if (!this.#avatarManaged) this.#ball.scaling.copyFrom(this.#ballBaseScale);
    this.#camera.position.copyFrom(this.#cameraBasePosition);
    if (this.#platform !== null) {
      this.#platform.visibility = this.#platformBaseVisibility;
    }
  }
}
