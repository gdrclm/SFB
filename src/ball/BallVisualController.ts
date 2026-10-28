import { BallCrystalGlow } from "./BallCrystalGlow";
import { ballActivity } from "./BallActivity";
import { getBallLimbs } from "./BallLimbs";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { TrailMesh } from "@babylonjs/core/Meshes/trailMesh";
import { BallDynamicsFX } from "./BallDynamicsFX";
import { speedVisualPower } from "./BallSpeedVisuals";
import { BallExpressionState, type BallExpression } from "./BallExpression";
import { getBallFace } from "./BallFace";
import type { SuccessfulBoostResult } from "../boost/BoostController";
import type { GameConfig, RgbColor } from "../config/gameConfig";
import type { FixedSimulationSystem } from "../core/FixedStepRunner";

interface BallMotion {
  readonly fallSpeed: number;
  readonly horizontalVelocity?: number;
  readonly verticalVelocity?: number;
  readonly isBouncing?: boolean;
  readonly impactCompression?: number;
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
  readonly #crystalOutlineColor = new Color3(.08, .92, 1);
  readonly #baseTrailColor = new Color3(.25, .9, 1);
  readonly #phaseOutlineColor: Color3;
  #speedIntensity = 0;
  #stretchIntensity = 0;
  #trailIntensity = 0;
  #phaseTransitionTarget = 0;
  #phaseTransitionBlend = 0;
  #boostElapsedSeconds: number | null = null;
  #boostStrength = 0;
  readonly #expression = new BallExpressionState();
  readonly #fx: BallDynamicsFX;
  readonly #crystalGlow: BallCrystalGlow;
  #crystalBlend = 0;
  #slowActive = false;
  #impactElapsed = 1;
  #contactAnchored = false;
  #impactKind: "hurt" | "break" = "break";
  #danger = false;
  #tutorialLaunchStart: Vector3 | null = null;
  #activityAge = 0;
  readonly #reducedMotion = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

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
    this.#trailMaterial.backFaceCulling = false;
    this.#trailMaterial.disableDepthWrite = true;
    this.#trailMaterial.diffuseColor = Color3.Black();
    this.#trailMaterial.alpha = 0.72;
    this.#trail.material = this.#trailMaterial;
    this.#fx = new BallDynamicsFX(ball, config.ball.radius,
      typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches, config.ball.startFallSpeed);
    this.#crystalGlow = new BallCrystalGlow(ball, config.ball.radius);
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
    this.#fx.trigger(event);
    if (event === "break" || event === "hurt" || event === "defeat") getBallLimbs(this.#ball)?.tuck(event === "defeat");
    // Contact still deforms the body while a higher-priority facial pose is held.
    if (event === "hurt" || event === "break") {
      this.#impactElapsed = 0; this.#impactKind = event;
      this.#anchorContact(true);
      const sy = event === "hurt" ? .56 : .66, cross = 1 / Math.sqrt(sy);
      this.#ball.scaling.set(this.#baseScale.x * cross, this.#baseScale.y * sy, this.#baseScale.z * cross);
    }
    if (!this.#expression.react(event)) return;
    (this.#ball.metadata as { expression: BallExpression }).expression = this.#expression.current;
    getBallFace(this.#ball)?.update(this.#expression.current, event === "defeat" ? .2 : .025, 0, event === "boost");
  }

  public renderDefeat(seconds: number, age: number): void {
    const dt = Math.max(0, Math.min(.1, seconds));
    getBallFace(this.#ball)?.update("defeat", dt, 0);
    getBallLimbs(this.#ball)?.update(dt, 0);
    const pulse = Math.exp(-age * 3) * Math.sin(age * 16);
    const amount = 1 - Math.exp(-12 * dt);
    const sy = .9 + pulse * .12;
    this.#ball.scaling.x += (this.#baseScale.x / Math.sqrt(sy) - this.#ball.scaling.x) * amount;
    this.#ball.scaling.y += (this.#baseScale.y * sy - this.#ball.scaling.y) * amount;
    this.#ball.scaling.z += (this.#baseScale.z / Math.sqrt(sy) - this.#ball.scaling.z) * amount;
    this.#ball.rotation.z += (.18 + Math.sin(age * 8) * .05 * Math.exp(-age * 2) - this.#ball.rotation.z) * amount;
    this.#fx.update(dt, { speed: 0, look: 0, boost: 0, anticipating: false, slow: false, danger: false });
  }

  public renderTutorialFinish(seconds: number, age: number, viewHeight: number, reducedMotion: boolean): void {
    this.#tutorialLaunchStart ??= this.#ball.position.clone();
    const launch = clamp01((age - .8) / .75);
    this.#anchorContact(false);
    this.#ball.rotation.z = age * (reducedMotion ? 4 : 10 + age * 22);
    this.#ball.rotation.x = Math.sin(age * 10) * .2;
    this.#ball.position.y = this.#tutorialLaunchStart.y + viewHeight * 1.5 * launch * launch;
    this.#ball.position.x = this.#tutorialLaunchStart.x + Math.sin(launch * Math.PI) * viewHeight * .1;
    const stretch = 1 + launch * 2;
    this.#ball.scaling.set(this.#baseScale.x / Math.sqrt(stretch), this.#baseScale.y * stretch, this.#baseScale.z / Math.sqrt(stretch));
    getBallFace(this.#ball)?.update("combo", Math.min(.1, seconds), 0);
    getBallLimbs(this.#ball)?.update(Math.min(.1, seconds), 80);
    this.#fx.update(Math.min(.1, seconds), { speed: 120, look: 0, boost: 1, anticipating: false, slow: false, danger: false });
  }

  public setCrystalBlend(blend: number): void {
    const weight = Number.isFinite(blend) ? clamp01(blend) : 0;
    if (weight === this.#crystalBlend) return;
    this.#crystalBlend = weight;
    this.#crystalGlow.setBlend(weight);
    this.#applyMaterial(this.#speedIntensity);
  }

  public setSlow(active: boolean): void { this.#slowActive = active; }

  public setDanger(danger: boolean): void { this.#danger = danger; }

  public setPhaseTransitionActive(active: boolean): void {
    this.#phaseTransitionTarget = active ? 1 : 0;
  }

  public fixedUpdate(fixedDeltaSeconds: number, realDeltaSeconds = fixedDeltaSeconds): void {
    const activitySpeed = this.#motion.isBouncing || this.#slowActive ? this.#ballConfig.startFallSpeed : this.#motion.fallSpeed;
    const activity = ballActivity(activitySpeed, this.#ballConfig.startFallSpeed);
    this.#activityAge += Math.min(.1, Math.max(0, realDeltaSeconds)) * activity.cadence * Math.PI * 2;
    getBallLimbs(this.#ball)?.update(realDeltaSeconds, activitySpeed);
    (this.#ball.metadata as { activity: string }).activity = this.#slowActive ? "slow" : this.#motion.isBouncing ? "recovery" : activity.mode;
    this.#expression.update(realDeltaSeconds, this.#motion.fallSpeed >= 45, this.#danger, this.#motion.fallSpeed >= 16);
    const faceExpression = this.#slowActive && ["neutral", "focus", "fall"].includes(this.#expression.current) ? "slow" : this.#expression.current;
    (this.#ball.metadata as { expression: BallExpression }).expression = faceExpression;
    const look = Math.max(-1, Math.min(1, (this.#motion.horizontalVelocity ?? 0) / 9));
    const blinking = getBallFace(this.#ball)?.update(faceExpression, realDeltaSeconds, look, (this.#boostElapsedSeconds !== null && this.#boostElapsedSeconds < .1) || (this.#expression.current === "break" && this.#impactElapsed < .07)) ?? false;
    const poseAmount = smoothFactor(10, realDeltaSeconds);
    const activePose = !this.#reducedMotion && !this.#slowActive && !this.#motion.isBouncing && this.#impactElapsed > .2;
    const flutter = activePose ? Math.sin(this.#activityAge) * activity.energy : 0;
    this.#ball.rotation.z += (-look * .35 + flutter * .065 - this.#ball.rotation.z) * poseAmount;
    this.#ball.rotation.y += (look * .35 - this.#ball.rotation.y) * poseAmount;
    this.#ball.rotation.x += ((activePose ? Math.cos(this.#activityAge * .5) * activity.energy * .12 : 0) - this.#ball.rotation.x) * poseAmount;
    this.#fx.update(realDeltaSeconds, { speed: this.#motion.isBouncing ? 0 : this.#motion.fallSpeed, look,
      boost: this.#motion.isBouncing || this.#boostElapsedSeconds === null ? 0 : this.#boostStrength,
      anticipating: this.#boostElapsedSeconds !== null && this.#boostElapsedSeconds < .1,
      slow: this.#slowActive || this.#expression.current === "slow", danger: this.#danger });
    this.#impactElapsed += realDeltaSeconds;
    const targetSpeedIntensity =
      1 -
      Math.exp(
        -Math.max(0, this.#motion.fallSpeed - this.#ballConfig.startFallSpeed) /
          this.#config.speedEffectRange,
      );
    const colorAmount = smoothFactor(this.#config.colorSharpness, fixedDeltaSeconds);
    this.#stretchIntensity = lerp(this.#stretchIntensity, speedVisualPower(this.#motion.fallSpeed, this.#ballConfig.startFallSpeed) ** 2.5, colorAmount);
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
      this.#stretchIntensity,
    );
    const boostStretch = this.#updateBoostReaction(fixedDeltaSeconds);
    const contact = this.#motion.impactCompression ?? (this.#impactElapsed < .045 ? 1 : 0);
    const airborne = this.#motion.isBouncing === true && (this.#motion.verticalVelocity ?? 0) > 0;
    const rebound = this.#impactElapsed >= .045 && this.#impactElapsed < .19
      ? Math.sin((this.#impactElapsed - .045) / .145 * Math.PI) * (this.#impactKind === "hurt" ? .35 : .6) : 0;
    const targetVerticalScale = contact > 0 ? (this.#impactKind === "hurt" ? .56 : .66)
      : airborne ? 1 + Math.min(.35, (this.#motion.verticalVelocity ?? 0) * .045)
      : Math.max(.55, movementStretch + boostStretch + rebound + Math.abs(look) * .08
        + (activePose ? Math.sin(this.#activityAge) * activity.pulse : 0)) * (blinking ? .9 : 1);
    this.#anchorContact(contact > 0);
    const scaleAmount = smoothFactor(this.#config.scaleSharpness, fixedDeltaSeconds);
    const verticalScale = lerp(this.#ball.scaling.y / this.#baseScale.y, targetVerticalScale, scaleAmount);
    // Preserve volume throughout interpolation, not only at the target poses.
    const crossScale = 1 / Math.sqrt(verticalScale);
    this.#ball.scaling.set(this.#baseScale.x * crossScale, this.#baseScale.y * verticalScale, this.#baseScale.z * crossScale);
    this.#applyMaterial(this.#speedIntensity);
    if (this.#motion.isBouncing) this.#trail.visibility = 0;
  }

  public dispose(): void {
    this.#ball.scaling.copyFrom(this.#baseScale);
    this.#ball.rotation.setAll(0);
    this.#ball.setPivotPoint(Vector3.Zero());
    this.#ball.metadata = { avatarManaged: false, expression: "neutral" };
    this.#speedIntensity = 0;
    this.#stretchIntensity = 0;
    this.#trailIntensity = 0;
    this.#phaseTransitionBlend = 0;
    this.#phaseTransitionTarget = 0;
    this.#crystalBlend = 0;
    this.#boostElapsedSeconds = null;
    this.#boostStrength = 0;
    this.#applyMaterial(0);
    this.#trail.stop();
    this.#trail.dispose();
    this.#trailMaterial.dispose();
    this.#fx.dispose();
    this.#crystalGlow.dispose();
  }

  #anchorContact(active: boolean): void {
    if (active === this.#contactAnchored) return;
    this.#contactAnchored = active;
    this.#ball.setPivotPoint(new Vector3(0, active ? -this.#ballConfig.radius : 0, 0));
  }

  #updateBoostReaction(fixedDeltaSeconds: number): number {
    const elapsedSeconds = this.#boostElapsedSeconds;
    if (elapsedSeconds === null) {
      return 0;
    }

    const progress = clamp01(elapsedSeconds / this.#config.boostDurationSeconds);
    const boostStretch = progress < .26
      ? -.38 * this.#boostStrength * Math.sin(progress / .26 * Math.PI / 2)
      : this.#config.boostStretch * this.#boostStrength * (.4 + .6 * speedVisualPower(this.#motion.fallSpeed, this.#ballConfig.startFallSpeed)) * (1 - (progress - .26) / .74) ** 2;
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
    Color3.LerpToRef(this.#baseTrailColor, displayColor, .35 + this.#trailIntensity * .35, this.#trailMaterial.emissiveColor);
    this.#trailMaterial.alpha = .85 + this.#trailIntensity * .1;
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
    Color3.LerpToRef(this.#ball.outlineColor, this.#crystalOutlineColor, this.#crystalBlend, this.#ball.outlineColor);
    this.#ball.outlineWidth = this.#crystalBlend * .012 + lerp(
      this.#config.baseOutlineWidth,
      this.#config.maximumOutlineWidth,
      speedIntensity,
    );
  }
}
