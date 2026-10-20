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
>;
type DifficultySource = Pick<PhaseOneController, "currentDifficulty">;
export type PlatformGeneratedListener = (plan: PlannedPlatform) => void;

export class PlatformGenerator implements FixedSimulationSystem {
  readonly #ball: GeneratorBall;
  readonly #pool: GeneratorPool;
  readonly #difficultySource: DifficultySource;
  readonly #config: GameConfig;
  #planner: PlatformRoutePlanner;
  readonly #random: () => number;
  public enabled = true;
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
    const activeY = pool.platforms
      .filter((platform) => platform.isActive)
      .map((platform) => platform.mesh.position.y);
    const initialLowestY = activeY.length > 0
      ? Math.min(...activeY)
      : ball.position.y;
    this.#planner = new PlatformRoutePlanner(initialLowestY, config, random);
  }

  public queueEncounter(theme: PlatformEncounterTheme): void { this.#planner.queueEncounter(theme); }

  public resumeFromCurrentPosition(): void {
    this.#planner = new PlatformRoutePlanner(this.#ball.position.y, this.#config, this.#random);
    this.enabled = true;
  }

  public fixedUpdate(): void {
    if (!this.enabled) return;
    this.#recyclePlatformsAbovePlayWindow();
    this.#fillLookAheadWindow();
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
          strength: plan.strength,
          strengthLevel: plan.strengthLevel,
          routeKind: plan.routeKind,
          widthScale: plan.widthScale,
          isTrap: plan.routeKind === "boost",
          kind: plan.kind,
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
            strength: choice.strength,
            strengthLevel: choice.strengthLevel,
            routeKind: choice.routeKind,
            widthScale: choice.widthScale,
            isTrap: choice.isTrap,
            kind: choice.kind,
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
