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
import {CourseSequenceProgress} from "./CourseSequenceProgress";
import type {WorldProgression} from "../progression/WorldProgression";

type GeneratorBall = Pick<BallController, "fallSpeed" | "position"> & Partial<Pick<BallController, "previousPosition">>;
type GeneratorPool = Pick<
  PlatformPool,
  "platforms" | "availableCount" | "acquire" | "release"
> & Partial<Pick<PlatformPool, "beginGeneration">>;
type DifficultySource = Pick<PhaseOneController, "currentDifficulty">;
export type PlatformGeneratedListener = (plan: PlannedPlatform, additionalCell: boolean) => void;

interface RowLayout {
  readonly createdAt:number;
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
  #motionClock=0;
  readonly #sequenceProgress=new CourseSequenceProgress();
  public get completedSequenceCount():number{return this.#sequenceProgress.count;}
  public get progression():WorldProgression{return this.#planner.progression;}
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
    this.#planner.setCompletedSequences(0);
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
    this.#sequenceProgress.reset();this.#planner.setCompletedSequences(0);
    this.#motionClock=0;
    this.#rows.clear();
    this.#rememberInitialRows();
    this.enabled = true;
  }

  public fixedUpdate(seconds = 0): void {
    if (!this.enabled) return;
    this.#motionClock+=Math.max(0,seconds);
    this.#sequenceProgress.advance(this.#ball.position.y+this.#config.ball.radius,(location,count)=>{this.#planner.setCompletedSequences(count,location);});
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
          ...(plan.turretVolley===undefined?{}:{turretVolley:plan.turretVolley}),
          ...(plan.overlay?{encounterOverlay:plan.overlay}:{}),
          ...(plan.appearance === undefined ? {} : { appearance: plan.appearance }),
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
            ...(choice.turretVolley===undefined?{}:{turretVolley:choice.turretVolley}),
            ...(plan.overlay?{encounterOverlay:plan.overlay}:{}),
            ...(choice.appearance === undefined ? {} : { appearance: choice.appearance }),
            ...this.#choiceMotion(plan,choice),
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
      if(plan.sequenceId!==undefined&&plan.location!==undefined){
        const bottom=Math.min(...members.map(member=>member.mesh.position.y))-Math.max(...this.#config.platforms.map(template=>template.size.height))/2;
        this.#sequenceProgress.record(plan.sequenceId,plan.location,bottom,plan.sequenceEnd===true);
      }
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
  #choiceMotion(plan:PlannedPlatform,choice:NonNullable<PlannedPlatform["choices"]>[number]):Partial<PlatformActivationProperties>{
    const motion=choice.lateralMotion??(plan.overlay==="moving-gap"?undefined:plan.lateralMotion);
    return motion?{lateralMotion:motion}:{};
  }

  #rememberRow(platforms: readonly PlatformController[], plan?: PlannedPlatform): void {
    const first = platforms[0];
    if (!first) return;
    const templateWidth = this.#config.platforms[0]?.size.width ?? 7.5;
    // Store the original layout independently of live meshes: a broken platform
    // must not return when the camera zooms or its pool slot is reused.
    const members = platforms.map(platform => ({
      x: platform.lateralMotion?platform.motionCenterX:platform.mesh.position.x,
      yOffset: platform.mesh.position.y - first.mesh.position.y,
      properties: {
        encounterTheme: platform.encounterTheme,
        ...(platform.mechanic === undefined ? {} : { mechanic: platform.mechanic }),
        ...(platform.turretVolley===undefined?{}:{turretVolley:platform.turretVolley}),
        ...(platform.encounterOverlay?{encounterOverlay:platform.encounterOverlay}:{}),
        ...(platform.appearance === undefined ? {} : { appearance: platform.appearance }),
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
      createdAt:this.#motionClock,
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
          if(row.plan?.overlay&&!row.members.some((_,index)=>row.generated.has(`${String(cell)}:${String(index)}`))&&this.#pool.availableCount<row.members.length)return;
          for (const [index, member] of row.members.entries()) {
            const key = `${String(cell)}:${String(index)}`;
            if (row.generated.has(key)) continue;
            if (this.#pool.availableCount < 1) return;
            const mirroredProperties:PlatformActivationProperties={...member.properties,
              ...(mirror<0&&member.properties.mechanic?.startsWith("wind")?{mechanic:member.properties.mechanic==="wind-left"?"wind-right":"wind-left"}:{}),
              ...(member.properties.lateralMotion?{lateralMotion:{...member.properties.lateralMotion,
                phase:member.properties.lateralMotion.phase+(this.#motionClock-row.createdAt)*Math.PI*2/member.properties.lateralMotion.period+(mirror<0?Math.PI:0)}}:{}),
              ...(member.properties.turretVolley?{turretVolley:{...member.properties.turretVolley,id:`${member.properties.turretVolley.id}/cell:${String(cell)}`}}:{}),
            };
            const platform = this.#pool.acquire(
              new Vector3(member.x * mirror + offset, row.y + member.yOffset + depthShift, this.#config.playSpace.depth),
              mirroredProperties,
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
                ...(plan.lateralMotion?{lateralMotion:this.#cellMotion(plan.lateralMotion,mirror,row.createdAt)}:{}),
                ...(plan.turretVolley?{turretVolley:{...plan.turretVolley,id:`${plan.turretVolley.id}/cell:${String(cell)}`}}:{}),
                ...(plan.movingPassage?{movingPassage:{...plan.movingPassage,x:plan.movingPassage.x*mirror+offset,
                  phase:plan.movingPassage.phase+(this.#motionClock-row.createdAt)*Math.PI*2/plan.movingPassage.period+(mirror<0?Math.PI:0)}}:{}),
                ...(plan.passage ? { passage: { ...plan.passage, x: plan.passage.x * mirror + offset } } : {}),
                ...(plan.choices ? { choices: plan.choices.map(choice => ({ ...choice, x: choice.x * mirror + offset,
                  ...(choice.lateralMotion?{lateralMotion:this.#cellMotion(choice.lateralMotion,mirror,row.createdAt)}:{}),
                  ...(choice.turretVolley?{turretVolley:{...choice.turretVolley,id:`${choice.turretVolley.id}/cell:${String(cell)}`}}:{}),
                })) } : {}),
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
  #cellMotion(motion:NonNullable<PlatformActivationProperties["lateralMotion"]>,mirror:number,createdAt:number):NonNullable<PlatformActivationProperties["lateralMotion"]>{
    return {...motion,phase:motion.phase+(this.#motionClock-createdAt)*Math.PI*2/motion.period+(mirror<0?Math.PI:0)};
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
