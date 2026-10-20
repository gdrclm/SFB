import { describe, expect, it, vi } from "vitest";
import { BallController } from "../ball/BallController";
import { gameConfig } from "../config/gameConfig";
import { GameState, type GameStateController } from "../core/GameStateController";
import { RunWallet } from "../currency/RunWallet";
import { BoostController } from "./BoostController";

function createBall(speed = gameConfig.ball.startFallSpeed): { fallSpeed: number } {
  return { fallSpeed: speed };
}

function createState(
  current: GameStateController["current"] = GameState.Playing,
): Pick<GameStateController, "current"> {
  return { current };
}

function createWallet(energy = gameConfig.economy.initialEnergy): RunWallet {
  return new RunWallet(energy, gameConfig.economy.energyPerCoin);
}

describe("BoostController", () => {
  it("increases the initial speed by about 50 percent", () => {
    const ball = createBall();
    const boost = new BoostController(ball, createState(), createWallet(), gameConfig);

    const result = boost.tryBoost();

    expect(result.success).toBe(true);
    expect(ball.fallSpeed).toBeCloseTo(15, 10);
    expect(ball.fallSpeed / gameConfig.ball.startFallSpeed).toBeCloseTo(1.5, 10);
  });

  it("adds fifty percent of the current speed on every boost", () => {
    const ball = createBall();
    const boost = new BoostController(ball, createState(), createWallet(), gameConfig);

    const firstBefore = ball.fallSpeed;
    boost.tryBoost();
    const firstIncrease = ball.fallSpeed - firstBefore;
    boost.fixedUpdate(1);
    const secondBefore = ball.fallSpeed;
    boost.tryBoost();
    const secondIncrease = ball.fallSpeed - secondBefore;

    expect(firstIncrease).toBeCloseTo(5, 10);
    expect(secondIncrease).toBeCloseTo(7.5, 10);
    expect(secondIncrease / secondBefore).toBeCloseTo(firstIncrease / firstBefore, 10);
  });

  it("keeps increasing actual falling distance after the third and later boosts", () => {
    const ball = new BallController(
      { position: { x: 0, y: 0, z: 0 } },
      { isActive: false, normalizedPosition: 0 },
      gameConfig,
    );
    const boost = new BoostController(ball, createState(), createWallet(1000), gameConfig);
    let previousDistance = 0;
    for (let press = 0; press < 6; press++) {
      const before = ball.fallSpeed;
      expect(boost.tryBoost().success).toBe(true);
      expect(ball.fallSpeed / before).toBeCloseTo(1.5);
      const y = ball.position.y;
      ball.fixedUpdate(0.1);
      const distance = y - ball.position.y;
      expect(distance).toBeGreaterThan(previousDistance);
      previousDistance = distance;
      boost.fixedUpdate(1);
    }
  });

  it("blocks repeated use for exactly one second", () => {
    const boost = new BoostController(
      createBall(),
      createState(),
      createWallet(),
      gameConfig,
    );

    expect(boost.tryBoost().success).toBe(true);
    expect(boost.tryBoost()).toEqual({ success: false, reason: "cooldown" });
    boost.fixedUpdate(0.999);
    expect(boost.canBoost).toBe(false);
    boost.fixedUpdate(0.001);
    expect(boost.canBoost).toBe(true);
  });

  it("blocks boost in slow mode", () => {
    const boost = new BoostController(
      createBall(),
      createState(GameState.SlowMode),
      createWallet(),
      gameConfig,
    );

    expect(boost.tryBoost()).toEqual({ success: false, reason: "slow-mode" });
  });

  it("blocks boost during bounce recovery", () => {
    const boost = new BoostController(
      createBall(),
      createState(GameState.BounceRecovery),
      createWallet(),
      gameConfig,
    );

    expect(boost.canBoost).toBe(false);
    expect(boost.tryBoost()).toEqual({
      success: false,
      reason: "bounce-recovery",
    });
  });

  it("blocks boost after the run has ended", () => {
    const boost = new BoostController(
      createBall(),
      createState(GameState.GameOver),
      createWallet(),
      gameConfig,
    );

    expect(boost.canBoost).toBe(false);
    expect(boost.tryBoost()).toEqual({
      success: false,
      reason: "game-not-playing",
    });
  });

  it("raises energy cost with speed and deducts it", () => {
    const ball = createBall(gameConfig.boost.costBandSpeed * 2);
    const boost = new BoostController(ball, createState(), createWallet(), gameConfig);

    expect(boost.energyCost).toBe(2);
    expect(boost.tryBoost().success).toBe(true);
    expect(boost.energy).toBe(gameConfig.economy.initialEnergy - 2);
  });

  it("does not impose a maximum speed", () => {
    const ball = createBall(1_000_000);
    const boost = new BoostController(
      ball,
      createState(),
      createWallet(1_000_000),
      gameConfig,
    );

    expect(boost.tryBoost().success).toBe(true);
    expect(ball.fallSpeed).toBeCloseTo(1_000_000 * 1.5, 8);
  });

  it("emits a visual-ready event only for successful boosts", () => {
    const boost = new BoostController(
      createBall(),
      createState(),
      createWallet(),
      gameConfig,
    );
    const listener = vi.fn();
    const unsubscribe = boost.onBoosted(listener);

    const result = boost.tryBoost();
    boost.tryBoost();

    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith(result);

    unsubscribe();
    boost.fixedUpdate(1);
    boost.tryBoost();
    expect(listener).toHaveBeenCalledOnce();
  });
});
