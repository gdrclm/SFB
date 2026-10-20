export interface RgbColor {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

export interface GameConfig {
  readonly simulation: {
    readonly fixedStepSeconds: number;
    readonly maxFrameSeconds: number;
  };
  readonly playSpace: {
    readonly halfWidth: number;
    readonly depth: number;
  };
  readonly ball: {
    readonly radius: number;
    readonly startPosition: Readonly<{ x: number; y: number }>;
    readonly startFallSpeed: number;
    readonly naturalAcceleration: number;
    readonly movementScale: number;
    readonly horizontalMaxSpeed: number;
    readonly horizontalAcceleration: number;
    readonly horizontalFollowRate: number;
    readonly horizontalReleaseDamping: number;
  };
  readonly ballVisual: {
    readonly baseColor: RgbColor;
    readonly speedColor: RgbColor;
    readonly phaseTransitionColor: RgbColor;
    readonly baseOutlineColor: RgbColor;
    readonly phaseOutlineColor: RgbColor;
    readonly speedEffectRange: number;
    readonly maximumMovementStretch: number;
    readonly boostStretch: number;
    readonly boostDurationSeconds: number;
    readonly scaleSharpness: number;
    readonly colorSharpness: number;
    readonly baseEmissiveStrength: number;
    readonly maximumEmissiveStrength: number;
    readonly baseOutlineWidth: number;
    readonly maximumOutlineWidth: number;
    readonly trailDiameterScale: number;
    readonly trailLength: number;
    readonly trailSegments: number;
    readonly baseTrailVisibility: number;
    readonly maximumTrailVisibility: number;
  };
  readonly boost: {
    readonly speedMultiplier: number;
    readonly cooldownSeconds: number;
    readonly costBandSpeed: number;
  };
  readonly economy: {
    readonly initialEnergy: number;
    readonly energyPerCoin: number;
    readonly speedPerCoin: number;
  };
  readonly slowMode: {
    readonly timeScale: number;
    readonly energyCost: number;
    readonly energyIntervalRealSeconds: number;
  };
  readonly coins: {
    readonly radius: number;
    readonly spinRadiansPerSecond: number;
    readonly poolSize: number;
    readonly spawnEveryRows: number;
    readonly recycleAboveBallDistance: number;
    readonly heightAbovePlatform: number;
    readonly richTrailCount: number;
    readonly richTrailSpacing: number;
    readonly positions: readonly Readonly<{ x: number; y: number }>[];
  };
  readonly platforms: readonly StaticPlatformConfig[];
  readonly phaseOne: {
    readonly stages: readonly PhaseOneStageConfig[];
  };
  readonly platformGeneration: {
    readonly poolSize: number;
    readonly lookAheadCount: number;
    readonly recycleAboveBallDistance: number;
    readonly minimumSpacing: number;
    readonly bypassOffsetX: number;
    readonly safeLaneX: number;
    readonly lowStrengthMaximum: number;
    readonly mediumStrengthMaximum: number;
    readonly standardWidthScale: number;
    readonly narrowWidthScale: number;
    readonly boostGateWidthScale: number;
    readonly boostGateStrengthMargin: number;
    readonly splitPlatformWidthScale: number;
    readonly splitPlatformOffsetX: number;
    readonly choiceStartStage: number;
    readonly choiceRowInterval: number;
    readonly choiceLaneOffsetX: number;
    readonly choicePlatformWidthScale: number;
    readonly superHeavyStrengthMultiplier: number;
    readonly superHeavyBoostMargin: number;
    readonly multiRowMinimumCount: number;
    readonly multiRowMaximumCount: number;
    readonly multiRowSideMargin: number;
    readonly multiRowGap: number;
    readonly encounterRows: number;
    readonly extendedEncounterRows: number;
  };
  readonly platformEffects: {
    readonly vitalityEnergy: number;
    readonly vitalityLives: number;
    readonly forcedSlowDurationRealSeconds: number;
  };
  readonly successfulHit: {
    readonly speedLoss: number;
    readonly platformEffectSeconds: number;
    readonly fragmentSpread: number;
    readonly fragmentDrop: number;
    readonly ballEffectSeconds: number;
    readonly ballVerticalStretch: number;
    readonly cameraEffectSeconds: number;
    readonly cameraImpulse: number;
  };
  readonly unsuccessfulHit: {
    readonly bounceSpeed: number;
    readonly bounceDurationSeconds: number;
    readonly repeatProtectionSeconds: number;
    readonly feedbackSeconds: number;
    readonly ballSquash: number;
    readonly cameraImpulse: number;
  };
  readonly run: {
    readonly initialLives: number;
  };
  readonly camera: {
    readonly distance: number;
    readonly orthographicSize: number;
    readonly speedThreshold: number;
    readonly speedZoomExponent: number;
    readonly followSharpness: number;
    readonly zoomSharpness: number;
    readonly safeVerticalRatio: number;
    readonly phaseTransitionExtraSize: number;
    readonly boostZoomExtraSize: number;
    readonly boostZoomDelaySeconds: number;
    readonly boostZoomReturnSeconds: number;
  };
  readonly physics: {
    readonly gravity: Readonly<{ x: number; y: number; z: number }>;
  };
}

export type PlatformStrengthLevel = "low" | "medium" | "high";
export type PlatformKind =
  | "standard"
  | "super-heavy"
  | "vitality"
  | "time-slow";

export interface PhaseOneStageConfig {
  readonly number: number;
  readonly durationSeconds: number;
  readonly platformStrength: Readonly<{ minimum: number; maximum: number }>;
  readonly reactionWindowSeconds: Readonly<{ minimum: number; maximum: number }>;
}

export interface StaticPlatformConfig {
  readonly id: string;
  readonly position: Readonly<{ x: number; y: number }>;
  readonly size: Readonly<{ width: number; height: number; depth: number }>;
  readonly strength: number;
  readonly strengthLevel: PlatformStrengthLevel;
}

export const gameConfig: GameConfig = Object.freeze({
  simulation: Object.freeze({
    fixedStepSeconds: 1 / 60,
    maxFrameSeconds: 0.25,
  }),
  playSpace: Object.freeze({
    halfWidth: 5,
    depth: 0,
  }),
  ball: Object.freeze({
    radius: 0.5,
    startPosition: Object.freeze({ x: 0, y: 4.5 }),
    startFallSpeed: 10,
    naturalAcceleration: 0.25,
    movementScale: 1 / 3,
    horizontalMaxSpeed: 16,
    horizontalAcceleration: 240,
    horizontalFollowRate: 20,
    horizontalReleaseDamping: 48,
  }),
  ballVisual: Object.freeze({
    baseColor: Object.freeze({ r: 0.92, g: 0.95, b: 0.98 }),
    speedColor: Object.freeze({ r: 0.5, g: 0.86, b: 1 }),
    phaseTransitionColor: Object.freeze({ r: 0.18, g: 0.5, b: 1 }),
    baseOutlineColor: Object.freeze({ r: 0.03, g: 0.12, b: 0.24 }),
    phaseOutlineColor: Object.freeze({ r: 0.02, g: 0.08, b: 0.28 }),
    speedEffectRange: 30,
    maximumMovementStretch: 1.22,
    boostStretch: 0.48,
    boostDurationSeconds: 0.38,
    scaleSharpness: 18,
    colorSharpness: 6,
    baseEmissiveStrength: 0.08,
    maximumEmissiveStrength: 0.42,
    baseOutlineWidth: 0.035,
    maximumOutlineWidth: 0.075,
    trailDiameterScale: 0.46,
    trailLength: 12,
    trailSegments: 12,
    baseTrailVisibility: 0.08,
    maximumTrailVisibility: 0.58,
  }),
  boost: Object.freeze({
    speedMultiplier: 1.5,
    cooldownSeconds: 1,
    costBandSpeed: 10,
  }),
  economy: Object.freeze({
    initialEnergy: 30,
    energyPerCoin: 2,
    speedPerCoin: 1,
  }),
  slowMode: Object.freeze({
    timeScale: 0.1,
    energyCost: 1,
    energyIntervalRealSeconds: 3,
  }),
  coins: Object.freeze({
    radius: 0.28,
    spinRadiansPerSecond: 2.8,
    poolSize: 36,
    spawnEveryRows: 2,
    recycleAboveBallDistance: 6,
    heightAbovePlatform: 1.15,
    richTrailCount: 10,
    richTrailSpacing: 0.65,
    positions: Object.freeze([
      Object.freeze({ x: 0, y: 2.8 }),
      Object.freeze({ x: 2.2, y: -0.5 }),
      Object.freeze({ x: -2.2, y: -3.5 }),
    ]),
  }),
  platforms: Object.freeze([
    Object.freeze({
      id: "platform-low",
      position: Object.freeze({ x: 0, y: 1 }),
      size: Object.freeze({ width: 7.5, height: 0.3, depth: 1 }),
      strength: 7,
      strengthLevel: "low" as const,
    }),
    Object.freeze({
      id: "platform-medium",
      position: Object.freeze({ x: 0, y: -2 }),
      size: Object.freeze({ width: 7.5, height: 0.45, depth: 1 }),
      strength: 8,
      strengthLevel: "medium" as const,
    }),
    Object.freeze({
      id: "platform-high",
      position: Object.freeze({ x: 0, y: -5 }),
      size: Object.freeze({ width: 7.5, height: 0.6, depth: 1 }),
      strength: 9,
      strengthLevel: "high" as const,
    }),
  ]),
  phaseOne: Object.freeze({
    stages: Object.freeze([
      Object.freeze({ number: 1, durationSeconds: 45, platformStrength: Object.freeze({ minimum: 7, maximum: 9 }), reactionWindowSeconds: Object.freeze({ minimum: 1.55, maximum: 1.8 }) }),
      Object.freeze({ number: 2, durationSeconds: 40, platformStrength: Object.freeze({ minimum: 9, maximum: 11 }), reactionWindowSeconds: Object.freeze({ minimum: 1.3, maximum: 1.55 }) }),
      Object.freeze({ number: 3, durationSeconds: 36, platformStrength: Object.freeze({ minimum: 11, maximum: 13 }), reactionWindowSeconds: Object.freeze({ minimum: 1.1667, maximum: 1.3 }) }),
      Object.freeze({ number: 4, durationSeconds: 33, platformStrength: Object.freeze({ minimum: 13, maximum: 15 }), reactionWindowSeconds: Object.freeze({ minimum: 1.0333, maximum: 1.1667 }) }),
      Object.freeze({ number: 5, durationSeconds: 30, platformStrength: Object.freeze({ minimum: 15, maximum: 18 }), reactionWindowSeconds: Object.freeze({ minimum: 0.9, maximum: 1.0333 }) }),
      Object.freeze({ number: 6, durationSeconds: 27, platformStrength: Object.freeze({ minimum: 18, maximum: 21 }), reactionWindowSeconds: Object.freeze({ minimum: 0.8, maximum: 0.9 }) }),
      Object.freeze({ number: 7, durationSeconds: 25, platformStrength: Object.freeze({ minimum: 21, maximum: 24 }), reactionWindowSeconds: Object.freeze({ minimum: 0.7, maximum: 0.8 }) }),
      Object.freeze({ number: 8, durationSeconds: 23, platformStrength: Object.freeze({ minimum: 24, maximum: 28 }), reactionWindowSeconds: Object.freeze({ minimum: 0.6, maximum: 0.7 }) }),
      Object.freeze({ number: 9, durationSeconds: 21, platformStrength: Object.freeze({ minimum: 28, maximum: 32 }), reactionWindowSeconds: Object.freeze({ minimum: 0.525, maximum: 0.6 }) }),
      Object.freeze({ number: 10, durationSeconds: 20, platformStrength: Object.freeze({ minimum: 32, maximum: 36 }), reactionWindowSeconds: Object.freeze({ minimum: 0.45, maximum: 0.525 }) }),
    ]),
  }),
  platformGeneration: Object.freeze({
    poolSize: 36,
    lookAheadCount: 6,
    recycleAboveBallDistance: 8,
    minimumSpacing: 3,
    bypassOffsetX: 4,
    safeLaneX: 3.5,
    lowStrengthMaximum: 9,
    mediumStrengthMaximum: 15,
    standardWidthScale: 0.92,
    narrowWidthScale: 0.58,
    boostGateWidthScale: 1.2,
    boostGateStrengthMargin: 1,
    splitPlatformWidthScale: 0.52,
    splitPlatformOffsetX: 2.55,
    choiceStartStage: 2,
    choiceRowInterval: 2,
    choiceLaneOffsetX: 3.1,
    choicePlatformWidthScale: 0.28,
    superHeavyStrengthMultiplier: 1.5,
    superHeavyBoostMargin: 2,
    multiRowMinimumCount: 2,
    multiRowMaximumCount: 4,
    multiRowSideMargin: 0.4,
    multiRowGap: 0.45,
    encounterRows: 4,
    extendedEncounterRows: 5,
  }),
  platformEffects: Object.freeze({
    vitalityEnergy: 10,
    vitalityLives: 1,
    forcedSlowDurationRealSeconds: 3,
  }),
  successfulHit: Object.freeze({
    speedLoss: 1,
    platformEffectSeconds: 0.55,
    fragmentSpread: 2.4,
    fragmentDrop: 2,
    ballEffectSeconds: 0.16,
    ballVerticalStretch: 1.35,
    cameraEffectSeconds: 0.14,
    cameraImpulse: 0.24,
  }),
  unsuccessfulHit: Object.freeze({
    bounceSpeed: 8,
    bounceDurationSeconds: 0.45,
    repeatProtectionSeconds: 0.5,
    feedbackSeconds: 0.45,
    ballSquash: 0.58,
    cameraImpulse: 0.12,
  }),
  run: Object.freeze({
    initialLives: 3,
  }),
  camera: Object.freeze({
    distance: 10,
    orthographicSize: 6,
    speedThreshold: 10,
    speedZoomExponent: 0.5,
    followSharpness: 7,
    zoomSharpness: 4,
    safeVerticalRatio: 0.6,
    phaseTransitionExtraSize: 2,
    boostZoomExtraSize: 1.5,
    boostZoomDelaySeconds: 0.18,
    boostZoomReturnSeconds: 3,
  }),
  physics: Object.freeze({
    gravity: Object.freeze({ x: 0, y: -9.81, z: 0 }),
  }),
});
