import type {
  GameConfig,
  PlatformKind,
  PlatformStrengthLevel,
} from "../config/gameConfig";
import type { PhaseOneDifficulty } from "../progression/PhaseOneController";
import type { PlatformRouteKind } from "./PlatformController";

export type PlatformEncounterTheme =
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
}

export interface PlannedPlatform {
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
  readonly encounterTheme: PlatformEncounterTheme;
  readonly encounterRowIndex: number;
  readonly coinTrail?: PlannedCoinTrail;
  readonly choices?: readonly PlannedPlatformChoice[];
}

export interface PlannedPlatformChoice {
  readonly x: number;
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

const ENCOUNTER_THEMES: readonly PlatformEncounterTheme[] = Object.freeze([
  "chaos",
  "trap",
  "deception",
  "rich-lane",
  "danger-lane",
  "death-tunnel",
]);

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
  #lastTheme: PlatformEncounterTheme | null = null;
  #activeTheme: PlatformEncounterTheme | null = null;
  #scheduledTheme: PlatformEncounterTheme | null = null;
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
  }

  public queueEncounter(theme: PlatformEncounterTheme): void {
    this.#scheduledTheme = theme;
    this.#activeTheme = theme;
    this.#encounterVariant = this.#randomIndex(4);
    this.#encounterRowIndex = 0;
    this.#pendingBlueprint = null;
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
    const blueprint = this.#getPendingBlueprint();
    const generation = this.#config.platformGeneration;
    const worldSpeed = ballSpeed * this.#config.ball.movementScale;
    const spacing = Math.max(
      generation.minimumSpacing,
      worldSpeed * difficulty.reactionWindowSeconds,
    );
    this.#nextY -= spacing;

    const predictedSpeedAtCollision = Math.max(
      0,
      ballSpeed -
        mandatoryPlatformsAhead * this.#config.successfulHit.speedLoss,
    );
    const reactionWindowSeconds =
      worldSpeed <= Number.EPSILON
        ? Number.POSITIVE_INFINITY
        : spacing / worldSpeed;
    const row = this.#planRowMembers(
      blueprint,
      predictedSpeedAtCollision,
      difficulty,
    );
    const primary = row.find((member) => member.isPrimaryLane);
    if (primary === undefined) {
      throw new Error("A generated encounter row must contain a primary lane.");
    }

    const coinTrail =
      blueprint.coinTrail === undefined
        ? undefined
        : {
            x: row[blueprint.coinLaneIndex ?? blueprint.primaryLaneIndex]?.x ?? primary.x,
            count: blueprint.coinTrail.count,
            spacing: blueprint.coinTrail.spacing,
            ...(blueprint.coinTrail.sway === undefined ? {} : { sway: blueprint.coinTrail.sway }),
          };
    const plan: PlannedPlatform = {
      x: primary.x,
      y: this.#nextY,
      strength: primary.strength,
      strengthLevel: primary.strengthLevel,
      routeKind: primary.routeKind,
      widthScale: primary.widthScale,
      safeLaneX: primary.x,
      reactionWindowSeconds,
      stageNumber: difficulty.stageNumber,
      kind: primary.kind,
      encounterTheme: theme,
      encounterRowIndex: themeRowIndex,
      ...(coinTrail === undefined ? {} : { coinTrail }),
      choices: row
        .filter((member) => member !== primary)
        .map((member) => ({
          x: member.x,
          strength: member.strength,
          strengthLevel: member.strengthLevel,
          routeKind: member.routeKind,
          widthScale: member.widthScale,
          kind: member.kind,
          isTrap: member.isTrap,
        })),
    };
    this.#advanceEncounter();
    return plan;
  }

  #planRowMembers(
    blueprint: RowBlueprint,
    predictedSpeedAtCollision: number,
    difficulty: PhaseOneDifficulty,
  ): readonly PlannedRowMember[] {
    const positions = this.#getLanePositions(blueprint.lanes.length);
    const widthScale = this.#getLaneWidthScale(blueprint.lanes.length);
    return positions.map((x, laneIndex) => {
      const member = blueprint.lanes[laneIndex];
      if (member === undefined) {
        throw new Error("An encounter row blueprint is incomplete.");
      }
      return {
        x,
        widthScale,
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
      this.#pendingBlueprint = this.#createBlueprint(
        this.#getActiveTheme(),
        this.#encounterRowIndex,
      );
    }
    return this.#pendingBlueprint;
  }

  #getActiveTheme(): PlatformEncounterTheme {
    if (this.#activeTheme === null) {
      const candidates = ENCOUNTER_THEMES.filter(
        (theme) => theme !== this.#lastTheme,
      );
      const selected = this.#scheduledTheme ?? candidates[this.#randomIndex(candidates.length)];
      if (selected === undefined) {
        throw new Error("At least one encounter theme must be available.");
      }
      this.#activeTheme = selected;
      this.#encounterVariant = this.#randomIndex(4);
    }
    return this.#activeTheme;
  }

  #createBlueprint(
    theme: PlatformEncounterTheme,
    rowIndex: number,
  ): RowBlueprint {
    switch (theme) {
      case "break-run":
        return { lanes: [SAFE_STANDARD, SAFE_STANDARD, SAFE_STANDARD], primaryLaneIndex: rowIndex % 3,
          coinLaneIndex: rowIndex % 3, coinTrail: { count: 3, spacing: .65 } };
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
    const primaryLaneIndex = this.#encounterVariant % 2;
    const lanes: RowMember[] = [BOOST_STANDARD, BOOST_STANDARD];
    lanes[primaryLaneIndex] = SAFE_STANDARD;
    const coinTrail =
      rowIndex === 0
        ? {
            count: this.#config.coins.richTrailCount,
            spacing: this.#config.coins.richTrailSpacing,
            sway: 0.45,
          }
        : undefined;
    return {
      lanes,
      primaryLaneIndex,
      coinLaneIndex: (primaryLaneIndex + 1) % 2,
      ...(coinTrail === undefined ? {} : { coinTrail }),
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

    const strength = Math.max(1, Math.floor(Math.min(baseStrength, predictedSpeedAtCollision)));
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
    this.#lastTheme = theme;
    this.#activeTheme = null;
    this.#encounterRowIndex = 0;
  }

  #getEncounterLength(theme: PlatformEncounterTheme): number {
    return theme === "rich-lane" || theme === "death-tunnel"
      ? this.#config.platformGeneration.extendedEncounterRows
      : this.#config.platformGeneration.encounterRows;
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

  #getLanePositions(count: number): readonly number[] {
    const generation = this.#config.platformGeneration;
    const usableWidth =
      this.#config.playSpace.halfWidth * 2 -
      generation.multiRowSideMargin * 2;
    const platformWidth =
      (usableWidth - generation.multiRowGap * (count - 1)) / count;
    const firstCenter =
      -this.#config.playSpace.halfWidth +
      generation.multiRowSideMargin +
      platformWidth / 2;
    return Array.from(
      { length: count },
      (_, index) =>
        firstCenter + index * (platformWidth + generation.multiRowGap),
    );
  }

  #getLaneWidthScale(count: number): number {
    const template = this.#config.platforms[0];
    if (template === undefined || template.size.width <= 0) {
      throw new Error("A positive-width platform template is required.");
    }
    const generation = this.#config.platformGeneration;
    const usableWidth =
      this.#config.playSpace.halfWidth * 2 -
      generation.multiRowSideMargin * 2;
    const width =
      (usableWidth - generation.multiRowGap * (count - 1)) / count;
    return width / template.size.width;
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
