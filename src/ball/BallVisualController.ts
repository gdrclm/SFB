import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import type { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { TrailMesh } from "@babylonjs/core/Meshes/trailMesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { BallExpressionState, type BallExpression } from "./BallExpression";
import { getBallFace } from "./BallFace";
import type { SuccessfulBoostResult } from "../boost/BoostController";
import type { GameConfig, RgbColor } from "../config/gameConfig";
import type { FixedSimulationSystem } from "../core/FixedStepRunner";

interface BallMotion {
  readonly fallSpeed: number;
  readonly horizontalVelocity?: number;
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
  readonly #boostSpeedMultiplier: number;
  readonly #baseScale: Vector3;
  readonly #baseColor: Color3;
  readonly #speedColor: Color3;
  readonly #phaseColor: Color3;
  readonly #baseOutlineColor: Color3;
  readonly #phaseOutlineColor: Color3;
  #speedIntensity = 0;
  #trailIntensity = 0;
  #phaseTransitionTarget = 0;
  #phaseTransitionBlend = 0;
  #boostElapsedSeconds: number | null = null;
  #boostStrength = 0;
  readonly #expression = new BallExpressionState();
  readonly #pulse: Mesh;
  readonly #pulseMaterial: StandardMaterial;
  #pulseElapsed = 1;
  #impactElapsed = 1;
  #impactKind: "hurt" | "break" = "break";
  #danger = false;

  public constructor(ball: Mesh, motion: BallMotion, config: GameConfig) {
    const material = ball.material;
    if (!(material instanceof StandardMaterial)) {
      throw new TypeError("Ball visual controller requires a StandardMaterial.");
    }

    this.#ball = ball;
    ball.metadata = { avatarManaged: true, expression: "neutral" };
    this.#material = material;
    this.#motion = motion;
    this.#ballConfig = config.ball;
    this.#config = config.ballVisual;
    this.#boostSpeedMultiplier = config.boost.speedMultiplier;
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
    this.#pulse = MeshBuilder.CreateTorus("BallReactionRing", { diameter: config.ball.radius * 2.2, thickness: config.ball.radius * .06, tessellation: 32 }, ball.getScene());
    this.#pulse.parent = ball; this.#pulse.rotation.x = Math.PI / 2; this.#pulse.isPickable = false;
    this.#pulseMaterial = new StandardMaterial("BallReactionRingMaterial", ball.getScene());
    this.#pulseMaterial.disableLighting = true; this.#pulseMaterial.emissiveColor = new Color3(.1, .85, 1);
    this.#pulse.material = this.#pulseMaterial; this.#pulse.visibility = 0;
    this.#applyMaterial(0);
  }

  public get speedIntensity(): number {
    return this.#speedIntensity;
  }

  public get phaseTransitionBlend(): number {
    return this.#phaseTransitionBlend;
  }

  public playBoostReaction(result: SuccessfulBoostResult): void {
    this.react("boost");
    this.#boostStrength = clamp01(
      (result.currentSpeed / Math.max(result.previousSpeed, Number.EPSILON) - 1) /
        (this.#boostSpeedMultiplier - 1),
    );
    this.#boostElapsedSeconds = 0;
  }

  public react(event: BallExpression): void {
    // Contact still deforms the body while a higher-priority facial pose is held.
    if (event === "hurt" || event === "break") { this.#impactElapsed = 0; this.#impactKind = event; }
    if (!this.#expression.react(event)) return;
    (this.#ball.metadata as { expression: BallExpression }).expression = this.#expression.current;
    getBallFace(this.#ball)?.update(this.#expression.current, event === "defeat" ? .2 : .025, 0);
    if (event !== "neutral" && event !== "focus") {
      this.#pulseElapsed = 0;
      this.#pulseMaterial.emissiveColor.set(event === "hurt" || event === "defeat" ? 1 : event === "coin" ? 1 : .1,
        event === "hurt" || event === "defeat" ? .12 : event === "coin" ? .75 : 1,
        event === "hurt" || event === "defeat" ? .2 : event === "coin" ? .12 : event === "heal" ? .45 : 1);
    }
  }

  public setDanger(danger: boolean): void { this.#danger = danger; }

  public setPhaseTransitionActive(active: boolean): void {
    this.#phaseTransitionTarget = active ? 1 : 0;
  }

  public fixedUpdate(fixedDeltaSeconds: number, realDeltaSeconds = fixedDeltaSeconds): void {
    this.#expression.update(realDeltaSeconds, this.#danger || this.#motion.fallSpeed >= 24);
    (this.#ball.metadata as { expression: BallExpression }).expression = this.#expression.current;
    const look = Math.max(-1, Math.min(1, (this.#motion.horizontalVelocity ?? 0) / 9));
    getBallFace(this.#ball)?.update(this.#expression.current, realDeltaSeconds, look);
    const poseAmount = smoothFactor(10, realDeltaSeconds);
    this.#ball.rotation.z += (-look * .18 - this.#ball.rotation.z) * poseAmount;
    this.#ball.rotation.y += (look * .2 - this.#ball.rotation.y) * poseAmount;
    this.#pulseElapsed += realDeltaSeconds;
    const pulse = clamp01(this.#pulseElapsed / .36);
    this.#pulse.scaling.setAll(1 + pulse * 1.4);
    this.#pulse.visibility = (1 - pulse) * .65;
    this.#impactElapsed += realDeltaSeconds;
    const targetSpeedIntensity =
      1 -
      Math.exp(
        -Math.max(0, this.#motion.fallSpeed - this.#ballConfig.startFallSpeed) /
          this.#config.speedEffectRange,
      );
    const colorAmount = smoothFactor(this.#config.colorSharpness, fixedDeltaSeconds);
    // Each doubling keeps adding visible weight instead of saturating after a few boosts.
    const trailTarget = clamp01(Math.log2(Math.max(1, this.#motion.fallSpeed / this.#ballConfig.startFallSpeed)) / 5);
    this.#trailIntensity = lerp(this.#trailIntensity, trailTarget, colorAmount);
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
    const impactProgress = clamp01(this.#impactElapsed / (this.#impactKind === "hurt" ? .4 : .25));
    const impact = impactProgress < .22 ? -Math.sin(impactProgress / .22 * Math.PI / 2)
      : Math.sin((impactProgress - .22) / .78 * Math.PI * 2 - Math.PI / 2) * (1 - impactProgress);
    const impactScale = impactProgress >= 1 ? 1 : 1 + impact * (this.#impactKind === "hurt" ? .38 : .22);
    const targetVerticalScale = Math.max(.55, (movementStretch + boostStretch) * impactScale);
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
    this.#ball.rotation.setAll(0);
    this.#ball.metadata = { avatarManaged: false, expression: "neutral" };
    this.#speedIntensity = 0;
    this.#trailIntensity = 0;
    this.#phaseTransitionBlend = 0;
    this.#phaseTransitionTarget = 0;
    this.#boostElapsedSeconds = null;
    this.#boostStrength = 0;
    this.#applyMaterial(0);
    this.#trail.stop();
    this.#trail.dispose();
    this.#trailMaterial.dispose();
    this.#pulse.dispose(); this.#pulseMaterial.dispose();
  }

  #updateBoostReaction(fixedDeltaSeconds: number): number {
    const elapsedSeconds = this.#boostElapsedSeconds;
    if (elapsedSeconds === null) {
      return 0;
    }

    const progress = clamp01(elapsedSeconds / this.#config.boostDurationSeconds);
    const boostStretch = progress < .12
      ? -.18 * this.#boostStrength * Math.sin(progress / .12 * Math.PI / 2)
      : this.#config.boostStretch * this.#boostStrength * (1 - (progress - .12) / .88) ** 2;
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
    this.#trailMaterial.alpha = .6 + this.#trailIntensity * .35;
    this.#trail.diameter = this.#ballConfig.radius * this.#config.trailDiameterScale * (1 + this.#trailIntensity * 2.4 + this.#boostStrength * .4);
    this.#trail.visibility = Math.max(this.#boostStrength * .65, lerp(
      this.#config.baseTrailVisibility,
      this.#config.maximumTrailVisibility,
      this.#trailIntensity,
    ));
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
