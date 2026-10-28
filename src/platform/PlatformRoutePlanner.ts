import { worldProgression, type WorldProgression, type WorldPhase } from "../progression/WorldProgression";
import type { DepthLocation } from "../scene/DepthLocations";
import { cascadeVariant, climaxTheme, courseSectionAt, sectionForTheme, sectionRows, sectionTheme, type CourseSection, type CascadeVariant } from "./CourseSections";
import { speedAfterBreak } from "../collision/BreakResistance";
import { courseMechanic, type PlatformMechanic } from "./PlatformMechanic";
import { createEncounterLayout, type EncounterLayout } from "./EncounterLayout";
import type {
  GameConfig,
  PlatformKind,
  PlatformStrengthLevel,
} from "../config/gameConfig";
import type { PhaseOneDifficulty } from "../progression/PhaseOneController";
import type { PlatformRouteKind } from "./PlatformController";

export type PlatformEncounterTheme =
  | "run-up"
  | "breather"
  | "climax"
  | "bait"
  | "break-run"
  | "chaos"
  | "trap"
  | "deception"
  | "rich-lane"
  | "danger-lane"
  | "death-tunnel";

export interface PlannedCoinTrail {
  readonly x: number;
  readonly count: number;
  readonly spacing: number;
  readonly sway?: number;
  readonly endX?: number;
  readonly curve?: number;
  readonly heightAbovePlatform?: number;
}

export interface PlannedPlatform {
  readonly mechanic?: PlatformMechanic;
  readonly x: number;
  readonly y: number;
  readonly strength: number;
  readonly strengthLevel: PlatformStrengthLevel;
  readonly routeKind: PlatformRouteKind;
  readonly widthScale: number;
  readonly safeLaneX: number;
  readonly reactionWindowSeconds: number;
  readonly stageNumber: number;
  readonly kind: PlatformKind;
  readonly section?: CourseSection;
  readonly worldPhase?: WorldPhase;
  readonly location?: DepthLocation;
  readonly cascadeVariant?: CascadeVariant;
  readonly lateralMotion?: Readonly<{ amplitude: number; period: number; phase: number }>;
  readonly encounterTheme: PlatformEncounterTheme;
  readonly encounterRowIndex: number;
  readonly externalEncounter?: boolean;
  readonly passage?: Readonly<{ x: number; width: number }>;
  readonly bandDepth?: number;
  readonly coinTrail?: PlannedCoinTrail;
  readonly choices?: readonly PlannedPlatformChoice[];
}

export interface PlannedPlatformChoice {
  readonly mechanic?: PlatformMechanic;
  readonly x: number;
  readonly yOffset?: number;
  readonly strength: number;
  readonly strengthLevel: PlatformStrengthLevel;
  readonly routeKind: PlatformRouteKind;
  readonly widthScale: number;
  readonly kind: PlatformKind;
  readonly isTrap: boolean;
}

type PlatformRole = "safe" | "boost" | "deadly";

interface RowMember {
  readonly kind: PlatformKind;
  readonly role: PlatformRole;
}

interface RowBlueprint {
  readonly lanes: readonly RowMember[];
  readonly primaryLaneIndex: number;
  readonly coinTrail?: Readonly<{ count: number; spacing: number; sway?: number }>;
  readonly coinLaneIndex?: number;
}

interface PlannedRowMember extends PlannedPlatformChoice {
  readonly isPrimaryLane: boolean;
}

const SAFE_STANDARD: RowMember = Object.freeze({
  kind: "standard",
  role: "safe",
});
const BOOST_STANDARD: RowMember = Object.freeze({
  kind: "standard",
  role: "boost",
});
const DEADLY_BLACK: RowMember = Object.freeze({
  kind: "super-heavy",
  role: "deadly",
});
const SAFE_VITALITY: RowMember = Object.freeze({
  kind: "vitality",
  role: "safe",
});
const SAFE_TIME_SLOW: RowMember = Object.freeze({
  kind: "time-slow",
  role: "safe",
});

export class PlatformRoutePlanner {
  readonly #config: GameConfig;
  readonly #random: () => number;
  #nextY: number;
  #previousPassageX: number | null = null;
  #previousBandDepth = 0;
  #zoneCycle = 0;
  #activeTheme: PlatformEncounterTheme | null = null;
  #externalEncounter = false;
  #scheduledTheme: PlatformEncounterTheme | null = null;
  #scheduledActive = false;
  #needsRecovery = false;
  #sectionAnchorX = 0;
  #progress: WorldProgression;
  #progressKey = "";
  #sectionCursor = 0;
  #section: CourseSection = "run-up";
  #encounterRowIndex = 0;
  #encounterVariant = 0;
  #pendingBlueprint: RowBlueprint | null = null;

  public constructor(
    initialLowestY: number,
    config: GameConfig,
    random: () => number = Math.random,
  ) {
    if (!Number.isFinite(initialLowestY)) {
      throw new RangeError("Initial platform Y must be finite.");
    }

    this.#nextY = initialLowestY;
    this.#config = config;
    this.#random = random;
    this.#progress = worldProgression(config.startDepth + config.ball.startPosition.y - initialLowestY);
  }

  public queueEncounter(theme: PlatformEncounterTheme): void {
    this.#syncProgression();
    this.#activeTheme = theme; this.#externalEncounter = true; this.#section = sectionForTheme(theme);
    this.#scheduledActive = false;
    this.#encounterVariant = this.#randomIndex(4);
    this.#encounterRowIndex = 0;
    this.#pendingBlueprint = null;
  }

  /** Timer requests wait for a completed phrase and a recovery passage. */
  public scheduleEncounter(theme: PlatformEncounterTheme): void {
    // Recovery is already part of every course cycle; do not stack timer breathers.
    if (theme === "breather") return;
    this.#syncProgression();
    this.#scheduledTheme ??= theme;
  }

  public getNextRowPlatformCount(): number {
    return this.#getPendingBlueprint().lanes.length;
  }

  public planNext(
    ballSpeed: number,
    mandatoryPlatformsAhead: number,
    difficulty: PhaseOneDifficulty,
  ): PlannedPlatform {
    if (!Number.isFinite(ballSpeed) || ballSpeed < 0) {
      throw new RangeError("Ball speed must be finite and non-negative.");
    }
    if (!Number.isInteger(mandatoryPlatformsAhead) || mandatoryPlatformsAhead < 0) {
      throw new RangeError("Mandatory platform count must be a non-negative integer.");
    }
    if (
      !Number.isFinite(difficulty.platformStrength) ||
      difficulty.platformStrength <= 0 ||
      !Number.isFinite(difficulty.reactionWindowSeconds) ||
      difficulty.reactionWindowSeconds <= 0
    ) {
      throw new RangeError("Phase difficulty values must be finite and positive.");
    }

    const theme = this.#getActiveTheme();
    const themeRowIndex = this.#encounterRowIndex;
    const layoutTheme = theme === "climax" ? climaxTheme(themeRowIndex) : theme;
    const blueprint = this.#getPendingBlueprint();
    const generation = this.#config.platformGeneration;
    const worldSpeed = ballSpeed * this.#config.ball.movementScale;
    const cascading = layoutTheme === "break-run";
    const variant = cascadeVariant(this.#progress.phase);
    const structured = !this.#externalEncounter || this.#scheduledActive;
    const mechanic = structured ? courseMechanic(layoutTheme, this.#progress.location, this.#progress.phase, theme==="climax"?themeRowIndex%4:themeRowIndex) : undefined;
    const movingAmplitude = mechanic === "moving" ? .9 : structured && this.#progress.location !== "sky" && this.#progress.phase !== "introduction"
      && (this.#section === "maneuver" || cascading) && Math.floor(themeRowIndex / 2) % 3 === 1 ? .35 : 0;
    const layout = createEncounterLayout(layoutTheme, structured ? themeRowIndex : themeRowIndex + this.#zoneCycle * 3,
      this.#encounterVariant, blueprint.lanes.length, this.#config.playSpace.halfWidth,
      this.#config.ball.radius, generation.multiRowSideMargin, {
        passageExtra: this.#progress.passageExtra + (this.#section === "breather" ? .5 : 0),
        routeScale: this.#progress.routeScale * (cascading && variant === "wide" ? .6 : 1), movingAmplitude,
        structured, ...(structured ? { routeAnchor: this.#sectionAnchorX,
          ...(this.#previousPassageX === null ? {} : { previousPassageX: this.#previousPassageX }) } : {}),
      });
    const turnDistance = this.#previousPassageX === null ? 0 : Math.abs(layout.passage.x - this.#previousPassageX);
    // Leave time to steer out of the preceding band's lowest island.
    const travelTime = .24 + turnDistance / this.#config.ball.horizontalMaxSpeed;
    const clearance = this.#config.ball.radius * 2 + Math.max(...this.#config.platforms.map(platform => platform.size.height)) + .15;
    const beat = structured ? Math.max(.6, difficulty.reactionWindowSeconds * .65) : difficulty.reactionWindowSeconds * .55;
    const clearSpacing = Math.max(generation.minimumSpacing,
      clearance + worldSpeed * Math.max(travelTime, beat * layout.rhythm * this.#progress.spacingScale));
    this.#nextY -= clearSpacing + this.#previousBandDepth;
    const bandDepth = (structured ? Math.min(1.5, Math.max(.65, worldSpeed * .08))
      : Math.min(3, Math.max(1.15, worldSpeed * .20))) * this.#progress.staggerScale;
    this.#previousBandDepth = bandDepth;
    this.#previousPassageX = layout.passage.x;

    let predictedSpeedAtCollision = ballSpeed;
    for (let i = 0; i < mandatoryPlatformsAhead; i++) {
      predictedSpeedAtCollision = speedAfterBreak(predictedSpeedAtCollision,
        Math.min(difficulty.platformStrength, predictedSpeedAtCollision), this.#config.successfulHit.maximumSpeedLossFraction, this.#config.successfulHit.maximumSpeedLoss);
    }
    const reactionWindowSeconds = worldSpeed <= Number.EPSILON ? Number.POSITIVE_INFINITY : clearSpacing / worldSpeed;
    const row = this.#planRowMembers(blueprint, layout, bandDepth, predictedSpeedAtCollision, difficulty).map(member => ({
      ...member,
      ...(mechanic === undefined || (mechanic !== "moving" && !member.isPrimaryLane) ? {} : {
        mechanic: mechanic === "wind-right" && member.x < layout.passage.x ? "wind-left" as const : mechanic,
      }),
    }));
    const primary = row.find((member) => member.isPrimaryLane);
    if (primary === undefined) {
      throw new Error("A generated encounter row must contain a primary lane.");
    }

    const coinTarget = row[blueprint.coinLaneIndex ?? blueprint.primaryLaneIndex] ?? primary;
    const coinTrail = blueprint.coinTrail === undefined ? undefined : {
      x: layout.passage.x,
      endX: coinTarget.x,
      curve: (this.#encounterVariant % 2 === 0 ? 1 : -1) * .35,
      heightAbovePlatform: clearSpacing * .8 + (coinTarget.yOffset ?? 0),
      count: blueprint.coinTrail.count,
      spacing: Math.min(blueprint.coinTrail.spacing, clearSpacing * .6 / Math.max(1, blueprint.coinTrail.count - 1)),
    };
    const plan: PlannedPlatform = {
      x: primary.x,
      y: this.#nextY,
      strength: primary.strength,
      strengthLevel: primary.strengthLevel,
      routeKind: primary.routeKind,
      widthScale: primary.widthScale,
      safeLaneX: layout.passage.x,
      passage: layout.passage,
      bandDepth,
      reactionWindowSeconds,
      stageNumber: difficulty.stageNumber,
      kind: primary.kind,
      ...(primary.mechanic === undefined ? {} : { mechanic: primary.mechanic }),
      encounterTheme: layoutTheme,
      section: this.#section, worldPhase: this.#progress.phase, location: this.#progress.location,
      ...(cascading ? { cascadeVariant: variant } : {}),
      ...(movingAmplitude > 0 ? { lateralMotion: { amplitude: movingAmplitude, period: 3.8, phase: 0 } } : {}),
      encounterRowIndex: themeRowIndex,
      externalEncounter: this.#externalEncounter,
      ...(coinTrail === undefined ? {} : { coinTrail }),
      choices: row
        .filter((member) => member !== primary)
        .map((member) => ({
          x: member.x,
          yOffset: member.yOffset ?? 0,
          strength: member.strength,
          strengthLevel: member.strengthLevel,
          routeKind: member.routeKind,
          widthScale: member.widthScale,
          kind: member.kind,
          ...(member.mechanic === undefined ? {} : { mechanic: member.mechanic }),
          isTrap: member.isTrap,
        })),
    };
    this.#advanceEncounter();
    return plan;
  }

  #planRowMembers(
    blueprint: RowBlueprint,
    layout: EncounterLayout,
    bandDepth: number,
    predictedSpeedAtCollision: number,
    difficulty: PhaseOneDifficulty,
  ): readonly PlannedRowMember[] {
    const templateWidth = this.#config.platforms[0]?.size.width ?? 7.5;
    return layout.islands.map((island, laneIndex) => {
      const member = blueprint.lanes[laneIndex];
      if (member === undefined) {
        throw new Error("An encounter row blueprint is incomplete.");
      }
      return {
        x: island.x,
        yOffset: laneIndex === blueprint.primaryLaneIndex ? 0 : -island.depthFraction * bandDepth,
        widthScale: island.width / templateWidth,
        kind: member.kind,
        isPrimaryLane: laneIndex === blueprint.primaryLaneIndex,
        ...this.#getMemberProperties(
          member,
          predictedSpeedAtCollision,
          difficulty.platformStrength,
        ),
      };
    });
  }

  #getPendingBlueprint(): RowBlueprint {
    if (this.#pendingBlueprint === null) {
      const theme = this.#getActiveTheme();
      const structured = !this.#externalEncounter || this.#scheduledActive;
      this.#pendingBlueprint = this.#createBlueprint(
        structured && theme === "climax" ? climaxTheme(this.#encounterRowIndex) : theme,
        structured ? Math.floor(this.#encounterRowIndex / 2) : this.#encounterRowIndex,
      );
      const layoutTheme=theme==="climax"?climaxTheme(this.#encounterRowIndex):theme;
      if(structured && courseMechanic(layoutTheme,this.#progress.location,this.#progress.phase,theme==="climax"?this.#encounterRowIndex%4:this.#encounterRowIndex)==="moving") {
        // Reserve room for the full shuttle sweep, instead of squeezing tiny cells.
        this.#pendingBlueprint={lanes:[SAFE_STANDARD,DEADLY_BLACK],primaryLaneIndex:0};
      }
    }
    return this.#pendingBlueprint;
  }

  #syncProgression(): void {
    const progress = worldProgression(this.#config.startDepth + this.#config.ball.startPosition.y - this.#nextY);
    const key = `${progress.location}:${progress.phase}`;
    if (key === this.#progressKey) return;
    // A difficulty phase may develop the next phrase, but never cut this one off.
    if (progress.location === this.#progress.location && this.#activeTheme !== null) return;
    if (progress.location !== this.#progress.location) {
      this.#scheduledTheme = null; this.#needsRecovery = false;
    } else if (["cascade", "maneuver", "tension", "climax"].includes(this.#section)) this.#needsRecovery = true;
    this.#progress = progress; this.#progressKey = key; this.#sectionCursor = 0;
    this.#activeTheme = null; this.#pendingBlueprint = null; this.#encounterRowIndex = 0;
    this.#externalEncounter = false;
    this.#scheduledActive = false;
  }

  #getActiveTheme(): PlatformEncounterTheme {
    this.#syncProgression();
    if (this.#activeTheme === null) {
      this.#sectionAnchorX = this.#previousPassageX ?? 0;
      if (this.#needsRecovery) {
        this.#needsRecovery = false; this.#section = "breather";
        this.#activeTheme = "breather"; this.#externalEncounter = false;
      } else if (this.#scheduledTheme !== null && this.#section === "breather") {
        this.#activeTheme = this.#scheduledTheme; this.#scheduledTheme = null;
        this.#section = sectionForTheme(this.#activeTheme);
        this.#externalEncounter = true; this.#scheduledActive = true;
      } else {
        this.#section = courseSectionAt(this.#progress.phase, this.#sectionCursor++);
        this.#activeTheme = sectionTheme(this.#section); this.#externalEncounter = false;
      }
      this.#zoneCycle += 1; this.#encounterVariant = this.#randomIndex(4);
    }
    return this.#activeTheme;
  }

  #createBlueprint(
    theme: PlatformEncounterTheme,
    rowIndex: number,
  ): RowBlueprint {
    switch (theme) {
      case "climax": return this.#createBlueprint(climaxTheme(rowIndex), rowIndex % 4);
      case "run-up": {
        const count = rowIndex % 3 === 2 ? 3 : 2;
        return { lanes: Array.from({ length: count }, () => SAFE_STANDARD), primaryLaneIndex: rowIndex % count,
          coinLaneIndex: rowIndex % count, coinTrail: { count: 4, spacing: .6 } };
      }
      case "breather": return { lanes: [rowIndex === 1 ? SAFE_VITALITY : SAFE_STANDARD], primaryLaneIndex: 0,
        coinLaneIndex: 0, coinTrail: { count: 2, spacing: .8 } };
      case "bait":
        return { lanes: [SAFE_STANDARD], primaryLaneIndex: 0 };
      case "break-run": {
        const count = rowIndex % 4 === 3 ? 1 : rowIndex % 2 === 0 ? 3 : 2;
        const risky = this.#progress.phase === "climax" && rowIndex % 3 === 2;
        const lanes: RowMember[] = Array.from({ length: count }, () => SAFE_STANDARD);
        if (risky && count > 1) lanes[(rowIndex + 1) % count] = BOOST_STANDARD;
        return { lanes, primaryLaneIndex: rowIndex % count,
          coinLaneIndex: risky && count > 1 ? (rowIndex + 1) % count : rowIndex % count,
          coinTrail: { count: risky ? 7 : 3, spacing: .65 } };
      }
      case "chaos":
        return this.#createChaosBlueprint();
      case "trap":
        return this.#createTrapBlueprint(rowIndex);
      case "deception":
        return this.#createDeceptionBlueprint(rowIndex);
      case "rich-lane":
        return this.#createRichLaneBlueprint(rowIndex);
      case "danger-lane":
        return this.#createDangerLaneBlueprint(rowIndex);
      case "death-tunnel":
        return this.#createDeathTunnelBlueprint(rowIndex);
    }
  }

  #createChaosBlueprint(): RowBlueprint {
    const generation = this.#config.platformGeneration;
    const count =
      generation.multiRowMinimumCount +
      this.#randomIndex(
        generation.multiRowMaximumCount -
          generation.multiRowMinimumCount +
          1,
      );
    const primaryLaneIndex = this.#randomIndex(count);
    const safeKinds = [SAFE_STANDARD, SAFE_VITALITY, SAFE_TIME_SLOW] as const;
    const lanes = Array.from(
      { length: count },
      (): RowMember => BOOST_STANDARD,
    );
    lanes[primaryLaneIndex] = safeKinds[this.#randomIndex(safeKinds.length)] ?? SAFE_STANDARD;
    const deadlyLaneIndex = (primaryLaneIndex + 1) % count;
    lanes[deadlyLaneIndex] = DEADLY_BLACK;
    for (let index = 0; index < count; index += 1) {
      if (index === primaryLaneIndex || index === deadlyLaneIndex) {
        continue;
      }
      lanes[index] = this.#randomIndex(2) === 0 ? BOOST_STANDARD : SAFE_TIME_SLOW;
    }
    return { lanes, primaryLaneIndex };
  }

  #createTrapBlueprint(rowIndex: number): RowBlueprint {
    const baseSequence = [0, 2, 1, 0];
    const primaryLaneIndex =
      ((baseSequence[rowIndex] ?? 0) + this.#encounterVariant) % 3;
    const lanes: RowMember[] = [BOOST_STANDARD, BOOST_STANDARD, BOOST_STANDARD];
    lanes[primaryLaneIndex] = rowIndex % 2 === 0 ? SAFE_VITALITY : SAFE_STANDARD;
    if (rowIndex > 0) {
      const previousBase = baseSequence[rowIndex - 1] ?? 0;
      const previousLane = (previousBase + this.#encounterVariant) % 3;
      lanes[previousLane] = DEADLY_BLACK;
    } else {
      lanes[(primaryLaneIndex + 2) % 3] = DEADLY_BLACK;
    }
    return { lanes, primaryLaneIndex };
  }

  #createDeceptionBlueprint(rowIndex: number): RowBlueprint {
    const mirrored = this.#encounterVariant % 2 === 1;
    if (rowIndex % 2 === 0) {
      const primaryLaneIndex = mirrored ? 2 : 0;
      const lanes: RowMember[] = mirrored
        ? [DEADLY_BLACK, SAFE_TIME_SLOW, SAFE_VITALITY]
        : [SAFE_VITALITY, SAFE_TIME_SLOW, DEADLY_BLACK];
      return { lanes, primaryLaneIndex };
    }
    const primaryLaneIndex = mirrored ? 0 : 2;
    const lanes: RowMember[] = mirrored
      ? [BOOST_STANDARD, DEADLY_BLACK, DEADLY_BLACK]
      : [DEADLY_BLACK, DEADLY_BLACK, BOOST_STANDARD];
    return { lanes, primaryLaneIndex };
  }

  #createRichLaneBlueprint(rowIndex: number): RowBlueprint {
    const count = rowIndex % 2 === 0 ? 2 : 3;
    const primaryLaneIndex = (this.#encounterVariant + rowIndex) % count;
    const lanes = Array.from({ length: count }, () => BOOST_STANDARD);
    lanes[primaryLaneIndex] = SAFE_STANDARD;
    if (count === 3) lanes[(primaryLaneIndex + 2) % count] = DEADLY_BLACK;
    return {
      lanes, primaryLaneIndex, coinLaneIndex: (primaryLaneIndex + 1) % count,
      coinTrail: { count: rowIndex === 0 ? this.#config.coins.richTrailCount : 5, spacing: this.#config.coins.richTrailSpacing },
    };
  }

  #createDangerLaneBlueprint(rowIndex: number): RowBlueprint {
    const sequence = [0, 3, 1, 2];
    const primaryLaneIndex =
      ((sequence[rowIndex] ?? 0) + this.#encounterVariant) % 4;
    const lanes: RowMember[] = [
      DEADLY_BLACK,
      DEADLY_BLACK,
      DEADLY_BLACK,
      DEADLY_BLACK,
    ];
    lanes[primaryLaneIndex] =
      rowIndex % 2 === 0 ? SAFE_STANDARD : BOOST_STANDARD;
    return { lanes, primaryLaneIndex };
  }

  #createDeathTunnelBlueprint(rowIndex: number): RowBlueprint {
    const mirrored = this.#encounterVariant % 2 === 1;
    const primaryLaneIndex =
      (rowIndex + (mirrored ? 1 : 0)) % 2 === 0 ? 1 : 2;
    const lanes: RowMember[] = [
      DEADLY_BLACK,
      SAFE_STANDARD,
      BOOST_STANDARD,
      DEADLY_BLACK,
    ];
    lanes[primaryLaneIndex] =
      rowIndex % 3 === 2 ? SAFE_TIME_SLOW : SAFE_STANDARD;
    return { lanes, primaryLaneIndex };
  }

  #getMemberProperties(
    member: RowMember,
    predictedSpeedAtCollision: number,
    baseStrength: number,
  ): Pick<
    PlannedPlatformChoice,
    "strength" | "strengthLevel" | "routeKind" | "isTrap"
  > {
    const generation = this.#config.platformGeneration;
    if (member.role === "deadly") {
      const strength = Math.ceil(Math.max(
        baseStrength * generation.superHeavyStrengthMultiplier,
        predictedSpeedAtCollision *
          this.#config.boost.speedMultiplier ** generation.superHeavyBoostMargin,
      ));
      return {
        strength,
        strengthLevel: "high",
        routeKind: "bypass",
        isTrap: true,
      };
    }

    if (member.role === "boost") {
      const strength = Math.floor(Math.min(
        Math.floor(predictedSpeedAtCollision * this.#config.boost.speedMultiplier),
        Math.max(
          baseStrength,
          predictedSpeedAtCollision + generation.boostGateStrengthMargin,
          this.#activeTheme === "rich-lane" ? predictedSpeedAtCollision * 1.3 : 0,
        ),
      ));
      return {
        strength,
        strengthLevel: this.#getStrengthLevel(strength),
        routeKind: "boost",
        isTrap: true,
      };
    }

    const ratio = this.#section === "run-up" ? .5 : this.#section === "breather" ? .45 : this.#progress.safeStrengthRatio;
    const strength = Math.max(1, Math.floor(Math.min(baseStrength, predictedSpeedAtCollision * ratio)));
    return {
      strength,
      strengthLevel: this.#getStrengthLevel(strength),
      routeKind: "mandatory",
      isTrap: false,
    };
  }

  #advanceEncounter(): void {
    const theme = this.#activeTheme;
    if (theme === null) {
      return;
    }
    this.#pendingBlueprint = null;
    this.#encounterRowIndex += 1;
    if (this.#encounterRowIndex < this.#getEncounterLength(theme)) {
      return;
    }
    this.#activeTheme = null;
    if (this.#scheduledActive) this.#needsRecovery = true;
    this.#scheduledActive = false;
    this.#encounterRowIndex = 0;
  }

  #getEncounterLength(theme: PlatformEncounterTheme): number {
    if (!this.#externalEncounter || this.#scheduledActive) return sectionRows(this.#section, this.#progress);
    return theme === "climax" ? 20 : theme === "rich-lane" || theme === "death-tunnel"
      ? this.#config.platformGeneration.extendedEncounterRows : this.#config.platformGeneration.encounterRows;
  }

  #randomIndex(length: number): number {
    if (!Number.isInteger(length) || length <= 0) {
      throw new RangeError("Random selection length must be a positive integer.");
    }
    const value = this.#random();
    const normalized = Number.isFinite(value)
      ? Math.max(0, Math.min(1 - Number.EPSILON, value))
      : 0;
    return Math.floor(normalized * length);
  }

  #getStrengthLevel(strength: number): PlatformStrengthLevel {
    const generation = this.#config.platformGeneration;
    if (strength <= generation.lowStrengthMaximum) {
      return "low";
    }
    if (strength <= generation.mediumStrengthMaximum) {
      return "medium";
    }
    return "high";
  }
}
