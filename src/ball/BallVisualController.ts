import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import type { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { TrailMesh } from "@babylonjs/core/Meshes/trailMesh";
import type { SuccessfulBoostResult } from "../boost/BoostController";
import type { GameConfig, RgbColor } from "../config/gameConfig";
import type { FixedSimulationSystem } from "../core/FixedStepRunner";

interface BallMotion {
  readonly fallSpeed: number;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function smoothFactor(sharpness: number, deltaSeconds: number): number {
  return 1 - Math.exp(-sharpness * deltaSeconds);
}

function lerp(start: number, end: number, amount: number): number {
  return start + (end - start) * clamp01(amount);
}

function toColor3(color: RgbColor): Color3 {
  return new Color3(color.r, color.g, color.b);
}

export class BallVisualController implements FixedSimulationSystem {
  readonly #ball: Mesh;
  readonly #material: StandardMaterial;
  readonly #motion: BallMotion;
  readonly #trail: TrailMesh;
  readonly #trailMaterial: StandardMaterial;
  readonly #ballConfig: GameConfig["ball"];
  readonly #config: GameConfig["ballVisual"];
  readonly #baseScale: Vector3;
  readonly #baseColor: Color3;
  readonly #speedColor: Color3;
  readonly #phaseColor: Color3;
  readonly #baseOutlineColor: Color3;
  readonly #phaseOutlineColor: Color3;
  #speedIntensity = 0;
  #phaseTransitionTarget = 0;
  #phaseTransitionBlend = 0;
  #boostElapsedSeconds: number | null = null;
  #boostStrength = 0;

  public constructor(ball: Mesh, motion: BallMotion, config: GameConfig) {
    const material = ball.material;
    if (!(material instanceof StandardMaterial)) {
      throw new TypeError("Ball visual controller requires a StandardMaterial.");
    }

    this.#ball = ball;
    this.#material = material;
    this.#motion = motion;
    this.#ballConfig = config.ball;
    this.#config = config.ballVisual;
    this.#baseScale = ball.scaling.clone();
    this.#baseColor = toColor3(this.#config.baseColor);
    this.#speedColor = toColor3(this.#config.speedColor);
    this.#phaseColor = toColor3(this.#config.phaseTransitionColor);
    this.#baseOutlineColor = toColor3(this.#config.baseOutlineColor);
    this.#phaseOutlineColor = toColor3(this.#config.phaseOutlineColor);
    this.#trail = new TrailMesh("BallSpeedTrail", ball, ball.getScene(), {
      diameter: config.ball.radius * this.#config.trailDiameterScale,
      length: this.#config.trailLength,
      segments: this.#config.trailSegments,
      sections: 4,
    });
    this.#trail.isPickable = false;
    this.#trailMaterial = new StandardMaterial(
      "BallSpeedTrailMaterial",
      ball.getScene(),
    );
    this.#trailMaterial.disableLighting = true;
    this.#trailMaterial.diffuseColor = Color3.Black();
    this.#trailMaterial.alpha = 0.72;
    this.#trail.material = this.#trailMaterial;
    this.#applyMaterial(0);
  }

  public get speedIntensity(): number {
    return this.#speedIntensity;
  }

  public get phaseTransitionBlend(): number {
    return this.#phaseTransitionBlend;
  }

  public playBoostReaction(result: SuccessfulBoostResult): void {
    const relativeIncrease =
      (result.currentSpeed - result.previousSpeed) /
      Math.max(result.previousSpeed, Number.EPSILON);
    this.#boostStrength = clamp01(relativeIncrease / 0.5);
    this.#boostElapsedSeconds = 0;
  }

  public setPhaseTransitionActive(active: boolean): void {
    this.#phaseTransitionTarget = active ? 1 : 0;
  }

  public fixedUpdate(fixedDeltaSeconds: number): void {
    const targetSpeedIntensity =
      1 -
      Math.exp(
        -Math.max(0, this.#motion.fallSpeed - this.#ballConfig.startFallSpeed) /
          this.#config.speedEffectRange,
      );
    const colorAmount = smoothFactor(this.#config.colorSharpness, fixedDeltaSeconds);
    this.#speedIntensity = lerp(
      this.#speedIntensity,
      targetSpeedIntensity,
      colorAmount,
    );
    this.#phaseTransitionBlend = lerp(
      this.#phaseTransitionBlend,
      this.#phaseTransitionTarget,
      colorAmount,
    );

    const movementStretch = lerp(
      1,
      this.#config.maximumMovementStretch,
      this.#speedIntensity,
    );
    const boostStretch = this.#updateBoostReaction(fixedDeltaSeconds);
    const targetVerticalScale = movementStretch + boostStretch;
    const targetHorizontalScale = 1 / Math.sqrt(targetVerticalScale);
    const scaleAmount = smoothFactor(this.#config.scaleSharpness, fixedDeltaSeconds);
    this.#ball.scaling.set(
      lerp(
        this.#ball.scaling.x,
        this.#baseScale.x * targetHorizontalScale,
        scaleAmount,
      ),
      lerp(
        this.#ball.scaling.y,
        this.#baseScale.y * targetVerticalScale,
        scaleAmount,
      ),
      lerp(
        this.#ball.scaling.z,
        this.#baseScale.z * targetHorizontalScale,
        scaleAmount,
      ),
    );
    this.#applyMaterial(this.#speedIntensity);
  }

  public dispose(): void {
    this.#ball.scaling.copyFrom(this.#baseScale);
    this.#speedIntensity = 0;
    this.#phaseTransitionBlend = 0;
    this.#phaseTransitionTarget = 0;
    this.#boostElapsedSeconds = null;
    this.#boostStrength = 0;
    this.#applyMaterial(0);
    this.#trail.stop();
    this.#trail.dispose();
    this.#trailMaterial.dispose();
  }

  #updateBoostReaction(fixedDeltaSeconds: number): number {
    const elapsedSeconds = this.#boostElapsedSeconds;
    if (elapsedSeconds === null) {
      return 0;
    }

    const progress = clamp01(elapsedSeconds / this.#config.boostDurationSeconds);
    const boostStretch =
      this.#config.boostStretch * this.#boostStrength * (1 - progress) ** 2;
    const nextElapsedSeconds = elapsedSeconds + fixedDeltaSeconds;
    this.#boostElapsedSeconds = nextElapsedSeconds;
    if (
      nextElapsedSeconds + Number.EPSILON >=
      this.#config.boostDurationSeconds
    ) {
      this.#boostElapsedSeconds = null;
      this.#boostStrength = 0;
    }
    return boostStretch;
  }

  #applyMaterial(speedIntensity: number): void {
    const speedColor = Color3.Lerp(
      this.#baseColor,
      this.#speedColor,
      speedIntensity,
    );
    const displayColor = Color3.Lerp(
      speedColor,
      this.#phaseColor,
      this.#phaseTransitionBlend,
    );
    const emissiveStrength = lerp(
      this.#config.baseEmissiveStrength,
      this.#config.maximumEmissiveStrength,
      speedIntensity,
    );

    this.#material.diffuseColor.copyFrom(displayColor);
    this.#material.emissiveColor.copyFrom(displayColor).scaleInPlace(emissiveStrength);
    this.#trailMaterial.emissiveColor.copyFrom(displayColor);
    this.#trail.visibility = lerp(
      this.#config.baseTrailVisibility,
      this.#config.maximumTrailVisibility,
      speedIntensity,
    );
    this.#ball.renderOutline = true;
    this.#ball.outlineColor.copyFrom(
      Color3.Lerp(
        this.#baseOutlineColor,
        this.#phaseOutlineColor,
        this.#phaseTransitionBlend,
      ),
    );
    this.#ball.outlineWidth = lerp(
      this.#config.baseOutlineWidth,
      this.#config.maximumOutlineWidth,
      speedIntensity,
    );
  }
}
