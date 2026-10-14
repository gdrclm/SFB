import type { BallPosition } from "../ball/BallController";
import type { GameConfig } from "../config/gameConfig";
import type { FixedSimulationSystem } from "../core/FixedStepRunner";
import type { PlannedPlatform } from "../platform/PlatformRoutePlanner";
import type { CoinController } from "./CoinController";

type CoinGeneratorBall = Readonly<{ position: BallPosition }>;

export class CoinGenerator implements FixedSimulationSystem {
  readonly #ball: CoinGeneratorBall;
  readonly #coins: readonly CoinController[];
  readonly #config: GameConfig;
  #generatedRowCount = 0;

  public constructor(
    ball: CoinGeneratorBall,
    coins: readonly CoinController[],
    config: GameConfig,
  ) {
    this.#ball = ball;
    this.#coins = coins;
    this.#config = config;
  }

  public fixedUpdate(): void {
    const recycleY =
      this.#ball.position.y + this.#config.coins.recycleAboveBallDistance;
    for (const coin of this.#coins) {
      if (coin.isActive && coin.mesh.position.y > recycleY) {
        coin.deactivate();
      }
    }
  }

  public handlePlatformGenerated(plan: PlannedPlatform): void {
    this.#generatedRowCount += 1;
    if (plan.coinTrail !== undefined) {
      this.#spawnCoinTrail(plan);
      return;
    }
    const interval = Math.max(
      1,
      this.#config.coins.spawnEveryRows - Math.floor((plan.stageNumber - 1) / 5),
    );
    if (this.#generatedRowCount % interval !== 0) {
      return;
    }

    const coin = this.#coins.find((candidate) => !candidate.isActive);
    if (coin === undefined) {
      return;
    }

    const routeX = plan.routeKind === "bypass" ? plan.safeLaneX : plan.x;
    coin.reactivate({
      x: routeX,
      y: plan.y + this.#config.coins.heightAbovePlatform,
    });
  }

  #spawnCoinTrail(plan: PlannedPlatform): void {
    const trail = plan.coinTrail;
    if (trail === undefined) {
      return;
    }
    const startY = plan.y + this.#config.coins.heightAbovePlatform;
    let spawnedCount = 0;
    for (const coin of this.#coins) {
      if (coin.isActive) {
        continue;
      }
      coin.reactivate({
        x: trail.x,
        y: startY - spawnedCount * trail.spacing,
      });
      spawnedCount += 1;
      if (spawnedCount >= trail.count) {
        return;
      }
    }
  }
}
