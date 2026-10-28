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

type GeneratorBall = Pick<BallController, "fallSpeed" | "position"> & Partial<Pick<BallController, "previousPosition">>;
type GeneratorPool = Pick<
  PlatformPool,
  "platforms" | "availableCount" | "acquire" | "release"
> & Partial<Pick<PlatformPool, "beginGeneration">>;
type DifficultySource = Pick<PhaseOneController, "currentDifficulty">;
export type PlatformGeneratedListener = (plan: PlannedPlatform, additionalCell: boolean) => void;

interface RowLayout {
  readonly y: number;
  lowestY: number;
  readonly members: readonly Readonly<{ x: number; yOffset: number; properties: PlatformActivationProperties }>[];
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
  readonly #bands = new WeakMap<PlatformController, { key: string; activationId: number }>();
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
  public scheduleEncounter(theme: PlatformEncounterTheme): void { this.#planner.scheduleEncounter(theme); }

  public resumeFromCurrentPosition(): void {
    this.#planner = new PlatformRoutePlanner(this.#ball.position.y, this.#config, this.#random);
    this.#rows.clear();
    this.#rememberInitialRows();
    this.enabled = true;
  }

  public fixedUpdate(seconds = 0): void {
    if (!this.enabled) return;
    for (const platform of this.#pool.platforms) if (platform.isActive && platform.lateralMotion) platform.advanceMotion(seconds);
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
      Math.max(this.#ball.position.y, this.#ball.previousPosition?.y ?? this.#ball.position.y) +
      this.#config.platformGeneration.recycleAboveBallDistance;
    for (const [key, row] of this.#rows) {
      if (row.lowestY > recycleY) this.#rows.delete(key);
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
          ...(plan.mechanic === undefined ? {} : { mechanic: plan.mechanic }),
          ...(plan.lateralMotion ? { lateralMotion: plan.lateralMotion } : {}),
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
            plan.y + (choice.yOffset ?? 0),
            this.#config.playSpace.depth,
          ),
          {
            encounterTheme: plan.encounterTheme,
            ...(choice.mechanic === undefined ? {} : { mechanic: choice.mechanic }),
            ...(plan.lateralMotion ? { lateralMotion: plan.lateralMotion } : {}),
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
      yOffset: platform.mesh.position.y - first.mesh.position.y,
      properties: {
        encounterTheme: platform.encounterTheme,
        ...(platform.mechanic === undefined ? {} : { mechanic: platform.mechanic }),
        ...(platform.lateralMotion ? { lateralMotion: platform.lateralMotion } : {}),
        strength: platform.strength,
        strengthLevel: platform.strengthLevel,
        routeKind: platform.routeKind,
        kind: platform.kind,
        widthScale: platform.width / templateWidth,
        isTrap: platform.routeKind !== "mandatory",
      },
    }));
    const key = first.mesh.position.y.toFixed(4);
    for (const platform of platforms) this.#bands.set(platform, { key, activationId: platform.activationId });
    this.#rows.set(key, {
      y: first.mesh.position.y, lowestY: Math.min(...platforms.map(platform => platform.mesh.position.y)), members, plan,
      generated: new Set(members.map((_, index) => `0:${String(index)}`)),
      completedCells: new Set([0]),
    });
  }

  #fillSideSpace(): void {
    const base = this.#config.playSpace.halfWidth;
    if (this.#halfWidth <= base + .01) return;
    // Continue the encounter with mirrored, vertically shifted island groups.
    // Nearer bands get the bounded pool budget first; widths stay fixed.
    const cellWidth = base * 2;
    const cellCount = Math.ceil((this.#halfWidth - base) / cellWidth);
    const rows = [...this.#rows.values()]
      .filter(row => row.lowestY < this.#ball.position.y)
      .sort((a, b) => b.y - a.y);
    for (const row of rows) {
      for (let distance = 1; distance <= cellCount; distance++) {
        for (const side of [-1, 1]) {
          const cell = distance * side;
          const offset = cell * cellWidth;
          const mirror = Math.abs(cell) % 2 === 0 ? 1 : -1;
          const phase = ((cell * 2 + (row.plan?.encounterRowIndex ?? 0)) % 5 + 5) % 5;
          const depthShift = -.11 * phase * (row.plan?.bandDepth ?? 1);
          for (const [index, member] of row.members.entries()) {
            const key = `${String(cell)}:${String(index)}`;
            if (row.generated.has(key)) continue;
            if (this.#pool.availableCount < 1) return;
            const platform = this.#pool.acquire(
              new Vector3(member.x * mirror + offset, row.y + member.yOffset + depthShift, this.#config.playSpace.depth),
              member.properties,
            );
            if (!platform) return;
            row.generated.add(key);
            this.#bands.set(platform, { key: row.y.toFixed(4), activationId: platform.activationId });
            row.lowestY = Math.min(row.lowestY, platform.mesh.position.y);
          }
          if (row.plan && !row.completedCells.has(cell)) {
            row.completedCells.add(cell);
            const plan = row.plan;
            for (const listener of this.#generatedListeners) {
              listener({
                ...plan, x: plan.x * mirror + offset, y: plan.y + depthShift, safeLaneX: plan.safeLaneX * mirror + offset,
                ...(plan.passage ? { passage: { ...plan.passage, x: plan.passage.x * mirror + offset } } : {}),
                ...(plan.choices ? { choices: plan.choices.map(choice => ({ ...choice, x: choice.x * mirror + offset })) } : {}),
                ...(plan.coinTrail ? { coinTrail: { ...plan.coinTrail, x: plan.coinTrail.x * mirror + offset,
                  ...(plan.coinTrail.endX === undefined ? {} : { endX: plan.coinTrail.endX * mirror + offset }),
                  ...(plan.coinTrail.curve === undefined ? {} : { curve: plan.coinTrail.curve * mirror }) } } : {}),
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
      platforms.map((platform) => {
        const band = this.#bands.get(platform);
        return band?.activationId === platform.activationId ? band.key : platform.mesh.position.y.toFixed(4);
      }),
    ).size;
  }
}
