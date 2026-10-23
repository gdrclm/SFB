import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { BallController } from "../ball/BallController";
import type { GameConfig } from "../config/gameConfig";
import type { FixedSimulationSystem } from "../core/FixedStepRunner";
import type { PlatformController } from "./PlatformController";
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
export type PlatformGeneratedListener = (plan: PlannedPlatform) => void;

export class PlatformGenerator implements FixedSimulationSystem {
  readonly #ball: GeneratorBall;
  readonly #pool: GeneratorPool;
  readonly #difficultySource: DifficultySource;
  readonly #config: GameConfig;
  #planner: PlatformRoutePlanner;
  #halfWidth: number;
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
  }

  public setPlayfieldHalfWidth(halfWidth: number): void {
    if (!Number.isFinite(halfWidth)) return;
    this.#halfWidth = Math.max(this.#config.playSpace.halfWidth, halfWidth);
    this.#planner.setPlayfieldHalfWidth(this.#halfWidth);
  }

  public queueEncounter(theme: PlatformEncounterTheme): void { this.#planner.queueEncounter(theme); }

  public resumeFromCurrentPosition(): void {
    this.#planner = new PlatformRoutePlanner(this.#ball.position.y, this.#config, this.#random);
    this.#planner.setPlayfieldHalfWidth(this.#halfWidth);
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

      for (const choice of plan.choices ?? []) {
        this.#pool.acquire(
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
      }

      activeAheadCount += 1;
      for (const listener of this.#generatedListeners) {
        listener(plan);
      }
      if (
        plan.routeKind !== "bypass" ||
        (plan.choices ?? []).some((choice) => choice.routeKind !== "bypass")
      ) {
        mandatoryAheadCount += 1;
      }
    }
  }

  #fillSideSpace(): void {
    const base = this.#config.playSpace.halfWidth;
    if (this.#halfWidth <= base + .01) return;
    const target = base + Math.ceil((this.#halfWidth - base) / base) * base - this.#config.platformGeneration.multiRowSideMargin;
    const rows = new Map<string, PlatformController[]>();
    for (const platform of this.#getActivePlatformsAhead()) {
      const key = platform.mesh.position.y.toFixed(4);
      const row = rows.get(key) ?? []; row.push(platform); rows.set(key, row);
    }
    const templateWidth = this.#config.platforms[0]?.size.width ?? 7.5;
    const gap = this.#config.platformGeneration.multiRowGap;
    for (const row of [...rows.values()].sort((a, b) => (b[0]?.mesh.position.y ?? 0) - (a[0]?.mesh.position.y ?? 0))) {
      const sample = row[0]; if (!sample) continue;
      const width = (platform: PlatformController): number => platform.width || templateWidth;
      for (const side of [-1, 1]) {
        const neighbor = row.reduce((outer, p) => side * p.mesh.position.x > side * outer.mesh.position.x ? p : outer, sample);
        let edge = Math.max(base, ...row.map(p => side * p.mesh.position.x + width(p) / 2));
        while (target - edge - gap >= 1.25) {
          if (this.#pool.availableCount < 1) return;
          const span = Math.min(base, target - edge - gap);
          const platform = this.#pool.acquire(new Vector3(side * (edge + gap + span / 2), sample.mesh.position.y, this.#config.playSpace.depth), {
            encounterTheme: neighbor.encounterTheme,
            strength: neighbor.strength, strengthLevel: neighbor.strengthLevel, routeKind: neighbor.routeKind, isTrap: neighbor.routeKind !== "mandatory",
            widthScale: span / templateWidth, kind: neighbor.kind === "time-slow" && !this.allowSlowPlatforms ? "standard" : neighbor.kind,
          });
          if (!platform) return;
          row.push(platform); edge += gap + span;
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
