import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { CoinChain, CoinController } from "../coin/CoinController";
import type { GameConfig } from "../config/gameConfig";
import type { FixedSimulationSystem } from "../core/FixedStepRunner";
import type { PlatformController } from "../platform/PlatformController";
import type { PlatformPool } from "../platform/PlatformPool";

type BaitBall = Readonly<{ position: Readonly<{ x: number; y: number }>; fallSpeed: number }>;
type BaitPool = Pick<PlatformPool, "platforms" | "availableCount" | "acquire">;
export interface BaitViewport { readonly halfWidth: number; readonly spaceBelow: number; }
interface BaitWave {
  readonly x: number;
  readonly topY: number;
  readonly bottomY: number;
  readonly initialCount: number;
  readonly chain: CoinChain;
  readonly final: boolean;
}

/** Reactive, finite coin lures use the existing pools and never move an exposed trap. */
export class BaitZoneController implements FixedSimulationSystem {
  readonly #ball: BaitBall;
  readonly #coins: readonly CoinController[];
  readonly #pool: BaitPool;
  readonly #config: GameConfig;
  readonly #viewport: () => BaitViewport;
  readonly #finished: () => void;
  readonly #random: () => number;
  #armed = false;
  #wave: BaitWave | null = null;
  #waveCount = 0;
  #waveLimit = 3;
  #age = 0;
  #cooldown = 0;

  public constructor(ball: BaitBall, coins: readonly CoinController[], pool: BaitPool, config: GameConfig,
    viewport: () => BaitViewport, finished: () => void, random = Math.random) {
    this.#ball = ball; this.#coins = coins; this.#pool = pool; this.#config = config;
    this.#viewport = viewport; this.#finished = finished; this.#random = random;
  }

  public get active(): boolean { return this.#armed; }
  public get waveCount(): number { return this.#waveCount; }
  public get waveLimit(): number { return this.#waveLimit; }

  public arm(): void {
    this.cancel();
    this.#armed = true;
    this.#waveLimit = 3 + Math.floor(Math.max(0, Math.min(.999999, this.#random())) * 4);
  }

  public cancel(): void {
    this.#armed = false; this.#wave = null; this.#waveCount = 0; this.#age = 0; this.#cooldown = 0;
  }

  public fixedUpdate(seconds: number): void {
    if (!this.#armed) return;
    const wave = this.#wave;
    if (wave === null) {
      let nearest: PlatformController | undefined;
      for (const platform of this.#pool.platforms) {
        if (platform.isActive && platform.mesh.position.y < this.#ball.position.y &&
          (!nearest || platform.mesh.position.y > nearest.mesh.position.y)) nearest = platform;
      }
      if (nearest?.encounterTheme === "bait") this.#spawnWave();
      return;
    }
    this.#age += Math.max(0, seconds);
    this.#cooldown = Math.max(0, this.#cooldown - seconds);
    // Ignoring a lure is a valid escape. It must not pursue the player forever.
    if (this.#ball.position.y < wave.bottomY - 1.5 || this.#age > 30) {
      this.#armed = false; this.#finished(); return;
    }
    if (wave.final || this.#cooldown > 0) return;
    const collected = wave.initialCount - wave.chain.remaining;
    const nearX = Math.abs(this.#ball.position.x - wave.x) < Math.max(.9, this.#viewport().halfWidth * .1);
    const nearY = this.#ball.position.y - wave.topY < Math.max(2, this.#ball.fallSpeed * this.#config.ball.movementScale * .65);
    if (nearX && (nearY || collected >= 3)) this.#spawnWave();
  }

  #spawnWave(): void {
    const selected = this.#coins.filter(coin => !coin.isActive).slice(0, 12);
    if (selected.length < 8) return;
    const final = this.#waveCount + 1 === this.#waveLimit;
    if (final && this.#pool.availableCount < 1) return;
    const view = this.#viewport();
    const side = this.#ball.position.x >= 0 ? -1 : 1;
    const x = side * Math.max(1.5, view.halfWidth * .64);
    const distance = Math.max(2.5, Math.min(Math.max(3.4, this.#ball.fallSpeed * this.#config.ball.movementScale * 1.1), view.spaceBelow - 4.2));
    const topY = this.#ball.position.y - distance;
    const coinGap = this.#config.coins.radius * 2 + .08;
    const lastY = topY - Math.floor((selected.length - 1) / 3) * coinGap;
    const bottomY = lastY - 1;
    if (final) {
      // Create before exposing the last coins. Its position and strength stay fixed.
      const platform = this.#pool.acquire(new Vector3(x, bottomY, this.#config.playSpace.depth), {
        encounterTheme: "bait", strength: Math.ceil(Math.max(1, this.#ball.fallSpeed * 2)),
        strengthLevel: "high", kind: "super-heavy", routeKind: "bypass", isTrap: true,
        widthScale: 2.25 / (this.#config.platforms[0]?.size.width ?? 7.5),
      });
      if (!platform) return;
    }
    const chain: CoinChain = { remaining: selected.length, cancelled: false };
    selected.forEach((coin, index) => {
      coin.reactivate({ x: x + (index % 3 - 1) * coinGap, y: topY - Math.floor(index / 3) * coinGap });
      coin.chain = chain;
    });
    this.#wave = { x, topY, bottomY, initialCount: selected.length, chain, final };
    this.#waveCount++;
    this.#cooldown = .45;
  }
}
