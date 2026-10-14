import type { BallPosition } from "../ball/BallController";
import type { GameConfig } from "../config/gameConfig";
import type { FixedSimulationSystem } from "../core/FixedStepRunner";
import type { RunWallet } from "../currency/RunWallet";
import type { CoinController } from "./CoinController";

interface CoinCollectionBall {
  readonly position: BallPosition;
  readonly previousPosition: BallPosition;
  fallSpeed: number;
}

export type CoinCollectedListener = (coin: CoinController) => void;

function distanceSquaredToSegment(
  pointX: number,
  pointY: number,
  start: BallPosition,
  end: BallPosition,
): number {
  const segmentX = end.x - start.x;
  const segmentY = end.y - start.y;
  const segmentLengthSquared = segmentX * segmentX + segmentY * segmentY;
  const projection =
    segmentLengthSquared <= Number.EPSILON
      ? 0
      : Math.max(
          0,
          Math.min(
            1,
            ((pointX - start.x) * segmentX + (pointY - start.y) * segmentY) /
              segmentLengthSquared,
          ),
        );
  const closestX = start.x + segmentX * projection;
  const closestY = start.y + segmentY * projection;
  const distanceX = pointX - closestX;
  const distanceY = pointY - closestY;
  return distanceX * distanceX + distanceY * distanceY;
}

export class CoinCollectionController implements FixedSimulationSystem {
  readonly #ball: CoinCollectionBall;
  readonly #coins: readonly CoinController[];
  readonly #wallet: Pick<RunWallet, "collectCoin">;
  readonly #collectionRadius: number;
  readonly #spinRadiansPerSecond: number;
  readonly #speedPerCoin: number;
  readonly #listeners = new Set<CoinCollectedListener>();

  public constructor(
    ball: CoinCollectionBall,
    coins: readonly CoinController[],
    wallet: Pick<RunWallet, "collectCoin">,
    config: GameConfig,
  ) {
    this.#ball = ball;
    this.#coins = coins;
    this.#wallet = wallet;
    this.#collectionRadius = config.ball.radius + config.coins.radius;
    this.#spinRadiansPerSecond = config.coins.spinRadiansPerSecond;
    this.#speedPerCoin = config.economy.speedPerCoin;
  }

  public onCollected(listener: CoinCollectedListener): () => void {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  public fixedUpdate(fixedDeltaSeconds: number): void {
    for (const coin of this.#coins) {
      if (!coin.isActive) {
        continue;
      }

      coin.mesh.rotation.z += this.#spinRadiansPerSecond * fixedDeltaSeconds;
      const distanceSquared = distanceSquaredToSegment(
        coin.mesh.position.x,
        coin.mesh.position.y,
        this.#ball.previousPosition,
        this.#ball.position,
      );
      if (
        distanceSquared >
        this.#collectionRadius * this.#collectionRadius
      ) {
        continue;
      }

      if (coin.collect()) {
        this.#wallet.collectCoin();
        this.#ball.fallSpeed += this.#speedPerCoin;
        for (const listener of this.#listeners) {
          listener(coin);
        }
      }
    }
  }

  public dispose(): void {
    this.#listeners.clear();
    for (const coin of this.#coins) {
      coin.dispose();
    }
  }
}
