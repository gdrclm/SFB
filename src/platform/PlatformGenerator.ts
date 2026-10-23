import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { BallController } from "../ball/BallController";
import type { GameConfig } from "../config/gameConfig";
import type { FixedSimulationSystem } from "../core/FixedStepRunner";
import type { PlatformActivationProperties, PlatformController } from "./PlatformController";
import type { PlatformPool } from "./PlatformPool";
import {
  PlatformRoutePlanner,
  type PlannedPlatform,
  type PlatformEncounterTheme,
} from "./PlatformRoutePlanner";
import type { PhaseOneController } from "../progression/PhaseOneController";

type GeneratorBall = Pick<BallController, "fallSpeed" | "position">;
type GeneratorPool = Pick<
  PlatformPool,
  "platforms" | "availableCount" | "acquire" | "release"
> & Partial<Pick<PlatformPool, "beginGeneration">>;
type DifficultySource = Pick<PhaseOneController, "currentDifficulty">;
export type PlatformGeneratedListener = (plan: PlannedPlatform, additionalCell: boolean) => void;

interface RowLayout {
  readonly y: number;
  readonly members: readonly Readonly<{ x: number; properties: PlatformActivationProperties }>[];
  readonly generated: Set<string>;
  readonly completedCells: Set<number>;
  readonly plan: PlannedPlatform | undefined;
}

export class PlatformGenerator implements FixedSimulationSystem {
  readonly #ball: GeneratorBall;
  readonly #pool: GeneratorPool;
  readonly #difficultySource: DifficultySource;
  readonly #config: GameConfig;
  #planner: PlatformRoutePlanner;
  #halfWidth: number;
  readonly #rows = new Map<string, RowLayout>();
  readonly #random: () => number;
  public enabled = true;
  public allowSlowPlatforms = true;
  readonly #generatedListeners = new Set<PlatformGeneratedListener>();

  public constructor(
    ball: GeneratorBall,
    pool: GeneratorPool,
    difficultySource: DifficultySource,
    config: GameConfig,
    random: () => number = Math.random,
  ) {
    this.#random = random;
    this.#ball = ball;
    this.#pool = pool;
    this.#difficultySource = difficultySource;
    this.#config = config;
    this.#halfWidth = config.playSpace.halfWidth;
    const activeY = pool.platforms
      .filter((platform) => platform.isActive)
      .map((platform) => platform.mesh.position.y);
    const initialLowestY = activeY.length > 0
      ? Math.min(...activeY)
      : ball.position.y;
    this.#planner = new PlatformRoutePlanner(initialLowestY, config, random);
    this.#rememberInitialRows();
  }

  public setPlayfieldHalfWidth(halfWidth: number): void {
    if (!Number.isFinite(halfWidth)) return;
    this.#halfWidth = Math.max(this.#config.playSpace.halfWidth, halfWidth);
  }

  public queueEncounter(theme: PlatformEncounterTheme): void { this.#planner.queueEncounter(theme); }

  public resumeFromCurrentPosition(): void {
    this.#planner = new PlatformRoutePlanner(this.#ball.position.y, this.#config, this.#random);
    this.#rows.clear();
    this.#rememberInitialRows();
    this.enabled = true;
  }

  public fixedUpdate(): void {
    if (!this.enabled) return;
    this.#pool.beginGeneration?.();
    this.#recyclePlatformsAbovePlayWindow();
    this.#fillLookAheadWindow();
    this.#fillSideSpace();
  }

  public onPlatformGenerated(listener: PlatformGeneratedListener): () => void {
    this.#generatedListeners.add(listener);
    return () => {
      this.#generatedListeners.delete(listener);
    };
  }

  #recyclePlatformsAbovePlayWindow(): void {
    const recycleY =
      this.#ball.position.y +
      this.#config.platformGeneration.recycleAboveBallDistance;
    for (const [key, row] of this.#rows) {
      if (row.y > recycleY) this.#rows.delete(key);
    }
    for (const platform of this.#pool.platforms) {
      if (platform.isActive && platform.mesh.position.y > recycleY) {
        this.#pool.release(platform);
      }
    }
  }

  #fillLookAheadWindow(): void {
    const ahead = this.#getActivePlatformsAhead();
    let activeAheadCount = this.#countRows(ahead);
    let mandatoryAheadCount = this.#countRows(
      ahead.filter((platform) => platform.routeKind !== "bypass"),
    );

    while (activeAheadCount < this.#config.platformGeneration.lookAheadCount) {
      const difficulty = this.#difficultySource.currentDifficulty;
      const requiredPlatforms = this.#planner.getNextRowPlatformCount();
      if (this.#pool.availableCount < requiredPlatforms) {
        return;
      }
      const plan = this.#planner.planNext(
        this.#ball.fallSpeed,
        mandatoryAheadCount,
        difficulty,
      );
      const platform = this.#pool.acquire(
        new Vector3(plan.x, plan.y, this.#config.playSpace.depth),
        {
          encounterTheme: plan.encounterTheme,
          strength: plan.strength,
          strengthLevel: plan.strengthLevel,
          routeKind: plan.routeKind,
          widthScale: plan.widthScale,
          isTrap: plan.routeKind === "boost",
          kind: !this.allowSlowPlatforms && plan.kind === "time-slow" ? "standard" : plan.kind,
        },
      );
      if (platform === null) {
        return;
      }

      const members = [platform];
      for (const choice of plan.choices ?? []) {
        const choicePlatform = this.#pool.acquire(
          new Vector3(
            choice.x,
            plan.y,
            this.#config.playSpace.depth,
          ),
          {
            encounterTheme: plan.encounterTheme,
            strength: choice.strength,
            strengthLevel: choice.strengthLevel,
            routeKind: choice.routeKind,
            widthScale: choice.widthScale,
            isTrap: choice.isTrap,
            kind: !this.allowSlowPlatforms && choice.kind === "time-slow" ? "standard" : choice.kind,
          },
        );
        if (choicePlatform) members.push(choicePlatform);
      }

      this.#rememberRow(members, plan);
      activeAheadCount += 1;
      for (const listener of this.#generatedListeners) {
        listener(plan, false);
      }
      if (
        plan.routeKind !== "bypass" ||
        (plan.choices ?? []).some((choice) => choice.routeKind !== "bypass")
      ) {
        mandatoryAheadCount += 1;
      }
    }
  }

  #rememberInitialRows(): void {
    const grouped = new Map<string, PlatformController[]>();
    for (const platform of this.#pool.platforms) {
      if (!platform.isActive) continue;
      const key = platform.mesh.position.y.toFixed(4);
      const members = grouped.get(key) ?? [];
      members.push(platform);
      grouped.set(key, members);
    }
    for (const members of grouped.values()) this.#rememberRow(members);
  }

  #rememberRow(platforms: readonly PlatformController[], plan?: PlannedPlatform): void {
    const first = platforms[0];
    if (!first) return;
    const templateWidth = this.#config.platforms[0]?.size.width ?? 7.5;
    // Store the original layout independently of live meshes: a broken platform
    // must not return when the camera zooms or its pool slot is reused.
    const members = platforms.map(platform => ({
      x: platform.mesh.position.x,
      properties: {
        encounterTheme: platform.encounterTheme,
        strength: platform.strength,
        strengthLevel: platform.strengthLevel,
        routeKind: platform.routeKind,
        kind: platform.kind,
        widthScale: platform.width / templateWidth,
        isTrap: platform.routeKind !== "mandatory",
      },
    }));
    this.#rows.set(first.mesh.position.y.toFixed(4), {
      y: first.mesh.position.y, members, plan,
      generated: new Set(members.map((_, index) => `0:${String(index)}`)),
      completedCells: new Set([0]),
    });
  }

  #fillSideSpace(): void {
    const base = this.#config.playSpace.halfWidth;
    if (this.#halfWidth <= base + .01) return;
    // Repeat fixed-size zone layouts instead of spreading 2–4 platforms over
    // the entire viewport. Populate nearer rows first within the pool budget.
    const cellWidth = base * 2;
    const cellCount = Math.ceil((this.#halfWidth - base) / cellWidth);
    const rows = [...this.#rows.values()]
      .filter(row => row.y < this.#ball.position.y)
      .sort((a, b) => b.y - a.y);
    for (const row of rows) {
      for (let distance = 1; distance <= cellCount; distance++) {
        for (const side of [-1, 1]) {
          const cell = distance * side;
          const offset = cell * cellWidth;
          for (const [index, member] of row.members.entries()) {
            const key = `${String(cell)}:${String(index)}`;
            if (row.generated.has(key)) continue;
            if (this.#pool.availableCount < 1) return;
            const platform = this.#pool.acquire(
              new Vector3(member.x + offset, row.y, this.#config.playSpace.depth),
              member.properties,
            );
            if (!platform) return;
            row.generated.add(key);
          }
          if (row.plan && !row.completedCells.has(cell)) {
            row.completedCells.add(cell);
            const plan = row.plan;
            for (const listener of this.#generatedListeners) {
              listener({
                ...plan, x: plan.x + offset, safeLaneX: plan.safeLaneX + offset,
                ...(plan.choices ? { choices: plan.choices.map(choice => ({ ...choice, x: choice.x + offset })) } : {}),
                ...(plan.coinTrail ? { coinTrail: { ...plan.coinTrail, x: plan.coinTrail.x + offset } } : {}),
              }, true);
            }
          }
        }
      }
    }
  }

  #getActivePlatformsAhead(): PlatformController[] {
    return this.#pool.platforms.filter(
      (platform) =>
        platform.isActive && platform.mesh.position.y < this.#ball.position.y,
    );
  }

  #countRows(platforms: readonly PlatformController[]): number {
    return new Set(
      platforms.map((platform) => platform.mesh.position.y.toFixed(4)),
    ).size;
  }
}
