import type { Camera } from "@babylonjs/core/Cameras/camera";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import type { Scene } from "@babylonjs/core/scene";
import type { SuccessfulHitFeedback } from "../collision/SuccessfulPlatformHitHandler";
import type { GameConfig } from "../config/gameConfig";
import type { FixedSimulationSystem } from "../core/FixedStepRunner";
import type { PlatformController } from "../platform/PlatformController";

const platformFragmentCount = 4;

interface PlatformFragmentState {
  readonly mesh: Mesh;
  readonly startPosition: Vector3;
  readonly endPosition: Vector3;
  readonly endRotation: number;
}

interface PlatformBreakState {
  readonly platform: AbstractMesh;
  readonly baseScale: Vector3;
  readonly crushedScale: Vector3;
  readonly flattenedScale: Vector3;
  readonly baseVisibility: number;
  readonly fragments: readonly PlatformFragmentState[];
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
  target.set(
    lerp(start.x, end.x, amount),
    lerp(start.y, end.y, amount),
    lerp(start.z, end.z, amount),
  );
}

export class SuccessfulHitEffects implements SuccessfulHitFeedback, FixedSimulationSystem {
  readonly #scene: Scene;
  readonly #ball: AbstractMesh;
  readonly #camera: Camera;
  readonly #config: GameConfig["successfulHit"];
  readonly #platformBreaks = new Set<PlatformBreakState>();
  readonly #ballBaseScale: Vector3;
  #ballReactionElapsedSeconds: number | null = null;
  #cameraReactionElapsedSeconds: number | null = null;
  #cameraBasePosition: Vector3;

  public constructor(scene: Scene, ball: AbstractMesh, camera: Camera, config: GameConfig) {
    this.#scene = scene;
    this.#ball = ball;
    this.#camera = camera;
    this.#config = config.successfulHit;
    this.#ballBaseScale = ball.scaling.clone();
    this.#cameraBasePosition = camera.position.clone();
  }

  public playPlatformBreak(platform: PlatformController, onComplete: () => void): void {
    const baseScale = platform.mesh.scaling.clone();
    const origin = platform.mesh.position.clone();
    const platformWidth = Number.isFinite(platform.width)
      ? platform.width
      : platform.size.width;
    const fragmentWidth = platformWidth / platformFragmentCount;
    const fragments: PlatformFragmentState[] = [];

    for (let index = 0; index < platformFragmentCount; index += 1) {
      const offsetX = -platformWidth / 2 + fragmentWidth * (index + 0.5);
      fragments.push(
        this.#createFragment(platform, origin, platformWidth, fragmentWidth, offsetX, index),
      );
    }

    this.#platformBreaks.add({
      platform: platform.mesh,
      baseScale,
      crushedScale: new Vector3(
        baseScale.x * 1.04,
        baseScale.y * 0.42,
        baseScale.z * 1.04,
      ),
      flattenedScale: new Vector3(
        baseScale.x * 0.9,
        baseScale.y * 0.12,
        baseScale.z * 0.9,
      ),
      baseVisibility: platform.mesh.visibility,
      fragments,
      onComplete,
      elapsedSeconds: 0,
    });
  }

  public playBallReaction(): void {
    this.#ball.scaling.copyFrom(this.#ballBaseScale);
    this.#ballReactionElapsedSeconds = 0;
  }

  public playCameraReaction(): void {
    this.#cameraBasePosition = this.#camera.position.clone();
    this.#cameraReactionElapsedSeconds = 0;
  }

  public fixedUpdate(fixedDeltaSeconds: number): void {
    this.#updatePlatformBreaks(fixedDeltaSeconds);
    this.#updateBallReaction(fixedDeltaSeconds);
    this.#updateCameraReaction(fixedDeltaSeconds);
  }

  public dispose(): void {
    for (const state of this.#platformBreaks) {
      state.platform.scaling.copyFrom(state.baseScale);
      state.platform.visibility = state.baseVisibility;
      for (const fragment of state.fragments) {
        fragment.mesh.dispose();
      }
    }
    this.#platformBreaks.clear();
    this.#ball.scaling.copyFrom(this.#ballBaseScale);
    this.#camera.position.copyFrom(this.#cameraBasePosition);
    this.#ballReactionElapsedSeconds = null;
    this.#cameraReactionElapsedSeconds = null;
  }

  #updatePlatformBreaks(fixedDeltaSeconds: number): void {
    for (const state of [...this.#platformBreaks]) {
      state.elapsedSeconds += fixedDeltaSeconds;
      const progress = clamp01(
        state.elapsedSeconds / this.#config.platformEffectSeconds,
      );

      if (progress <= 0.18) {
        copyLerp(
          state.platform.scaling,
          state.baseScale,
          state.crushedScale,
          progress / 0.18,
        );
      } else {
        copyLerp(
          state.platform.scaling,
          state.crushedScale,
          state.flattenedScale,
          (progress - 0.18) / 0.3,
        );
      }

      state.platform.visibility =
        progress <= 0.28
          ? state.baseVisibility
          : state.baseVisibility * (1 - clamp01((progress - 0.28) / 0.2));

      const easedProgress = 1 - (1 - progress) ** 3;
      for (const fragment of state.fragments) {
        copyLerp(
          fragment.mesh.position,
          fragment.startPosition,
          fragment.endPosition,
          easedProgress,
        );
        fragment.mesh.rotation.z = fragment.endRotation * easedProgress;
        fragment.mesh.scaling.setAll(lerp(1, 0.72, progress));
        fragment.mesh.visibility =
          progress <= 0.65 ? 1 : 1 - clamp01((progress - 0.65) / 0.35);
      }

      if (progress < 1) {
        continue;
      }

      state.platform.scaling.copyFrom(state.baseScale);
      state.platform.visibility = state.baseVisibility;
      for (const fragment of state.fragments) {
        fragment.mesh.dispose();
      }
      this.#platformBreaks.delete(state);
      state.onComplete();
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
    const impulse = this.#config.cameraImpulse;
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

  #createFragment(
    platform: PlatformController,
    origin: Vector3,
    platformWidth: number,
    fragmentWidth: number,
    offsetX: number,
    index: number,
  ): PlatformFragmentState {
    const direction = offsetX < 0 ? -1 : 1;
    const mesh = MeshBuilder.CreateBox(
      `${platform.id}-fragment-${String(index)}`,
      {
        width: fragmentWidth,
        height: platform.size.height,
        depth: platform.size.depth,
      },
      this.#scene,
    );
    mesh.material = platform.mesh.material;
    mesh.isPickable = false;
    mesh.position.copyFrom(origin);
    mesh.position.x += offsetX;

    const startPosition = mesh.position.clone();
    const distanceFromCenter = Math.abs(offsetX) / (platformWidth / 2);
    const outwardForce = 0.55 + distanceFromCenter * 0.45;
    const verticalScatter = index % 2 === 0 ? 0.28 : -0.08;
    const endPosition = startPosition.add(
      new Vector3(
        direction * this.#config.fragmentSpread * outwardForce,
        -this.#config.fragmentDrop + verticalScatter,
        0,
      ),
    );

    return {
      mesh,
      startPosition,
      endPosition,
      endRotation: direction * (0.55 + index * 0.13),
    };
  }
}
