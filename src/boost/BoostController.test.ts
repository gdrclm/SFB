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

function charge(boost: BoostController): void {
  for (let i = 0; i < boost.hitsRequired; i++) boost.recordSuccessfulHit();
}
function createChargedBoost(...args: ConstructorParameters<typeof BoostController>): BoostController {
  const boost = new BoostController(...args);
  charge(boost);
  return boost;
}

describe("BoostController", () => {
  it("increases the initial speed by about 50 percent", () => {
    const ball = createBall();
    const boost = createChargedBoost(ball, createState(), createWallet(), gameConfig);

    const result = boost.tryBoost();

    expect(result.success).toBe(true);
    expect(ball.fallSpeed).toBeCloseTo(15, 10);
    expect(ball.fallSpeed / gameConfig.ball.startFallSpeed).toBeCloseTo(1.5, 10);
  });

  it("adds fifty percent of the current speed on every boost", () => {
    const ball = createBall();
    const boost = createChargedBoost(ball, createState(), createWallet(), gameConfig);

    const firstBefore = ball.fallSpeed;
    boost.tryBoost();
    const firstIncrease = ball.fallSpeed - firstBefore;
    boost.fixedUpdate(1);
    charge(boost);
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
    const boost = createChargedBoost(ball, createState(), createWallet(1000), gameConfig);
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
    charge(boost);
    }
  });

  it("blocks repeated use for exactly one second", () => {
    const boost = createChargedBoost(
      createBall(),
      createState(),
      createWallet(),
      gameConfig,
    );

    expect(boost.tryBoost().success).toBe(true);
    expect(boost.tryBoost()).toEqual({ success: false, reason: "cooldown" });
    boost.fixedUpdate(0.999);
    expect(boost.canBoost).toBe(false);
    charge(boost);
    boost.fixedUpdate(0.001);
    expect(boost.canBoost).toBe(true);
  });

  it("blocks boost in slow mode", () => {
    const boost = createChargedBoost(
      createBall(),
      createState(GameState.SlowMode),
      createWallet(),
      gameConfig,
    );

    expect(boost.tryBoost()).toEqual({ success: false, reason: "slow-mode" });
  });

  it("blocks boost during bounce recovery", () => {
    const boost = createChargedBoost(
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
    const boost = createChargedBoost(
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
    const boost = createChargedBoost(ball, createState(), createWallet(), gameConfig);

    expect(boost.energyCost).toBe(2);
    expect(boost.tryBoost().success).toBe(true);
    expect(boost.energy).toBe(gameConfig.economy.initialEnergy - 2);
  });

  it("does not impose a maximum speed", () => {
    const ball = createBall(1_000_000);
    const boost = createChargedBoost(
      ball,
      createState(),
      createWallet(1_000_000),
      gameConfig,
    );

    expect(boost.tryBoost().success).toBe(true);
    expect(ball.fallSpeed).toBeCloseTo(1_000_000 * 1.5, 8);
  });

  it("emits a visual-ready event only for successful boosts", () => {
    const boost = createChargedBoost(
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
    charge(boost);
    boost.tryBoost();
    expect(listener).toHaveBeenCalledOnce();
  });
});

it("lets a ready, paid boost leave slow mode before accelerating, without cancelling it on a rejected attempt", () => {
  const state = { current: GameState.SlowMode as GameState };
  const ball = createBall(); const wallet = createWallet(0);
  const leave = vi.fn(() => { state.current = GameState.Playing; });
  const boost = createChargedBoost(ball, state, wallet, gameConfig, leave);
  expect(boost.tryBoost()).toMatchObject({ success: false, reason: "insufficient-energy" });
  expect(leave).not.toHaveBeenCalled();
  expect(state.current).toBe(GameState.SlowMode);
  wallet.addEnergy(10);
  expect(boost.canBoost).toBe(true);
  expect(boost.tryBoost().success).toBe(true);
  expect(leave).toHaveBeenCalledOnce();
  expect(state.current).toBe(GameState.Playing);
  expect(ball.fallSpeed).toBe(15);
});


it("starts empty: neither time nor a large energy balance can buy a charge", () => {
  const wallet = createWallet(1000), ball = createBall();
  const boost = new BoostController(ball, createState(), wallet, gameConfig);
  expect(boost.tryBoost()).toEqual({ success: false, reason: "combo-required" });
  expect(boost.canBoost).toBe(false); expect(wallet.energy).toBe(1000);
  boost.fixedUpdate(120); wallet.addEnergy(1000);
  expect(boost.chargeHits).toBe(0); expect(boost.canBoost).toBe(false);
  expect(ball.fallSpeed).toBe(10);
});

it("requires six consecutive hits, saves one charge and never banks spare hits", () => {
  const boost = new BoostController(createBall(), createState(), createWallet(), gameConfig);
  for (let i = 1; i < 6; i++) {
    expect(boost.recordSuccessfulHit()).toBe(false);
    expect(boost.chargeHits).toBe(i); expect(boost.canBoost).toBe(false);
  }
  expect(boost.recordSuccessfulHit()).toBe(true); expect(boost.canBoost).toBe(true);
  for (let i = 0; i < 30; i++) expect(boost.recordSuccessfulHit()).toBe(false);
  expect(boost.chargeProgress).toBe(1);
  expect(boost.tryBoost().success).toBe(true);
  boost.fixedUpdate(10);
  expect(boost.canBoost).toBe(false); expect(boost.chargeHits).toBe(0);
  expect(boost.tryBoost()).toEqual({ success: false, reason: "combo-required" });
});

it("resets a broken partial combo, but keeps an already earned charge", () => {
  const boost = new BoostController(createBall(), createState(), createWallet(), gameConfig);
  for (let i = 0; i < 5; i++) boost.recordSuccessfulHit();
  boost.resetComboCharge(); expect(boost.chargeHits).toBe(0);
  boost.recordSuccessfulHit(); expect(boost.chargeHits).toBe(1); expect(boost.canBoost).toBe(false);
  charge(boost); boost.resetComboCharge();
  expect(boost.hasCharge).toBe(true); expect(boost.canBoost).toBe(true);
});

it("retains an earned charge on rejected use and ignores hits while paused", () => {
  const wallet = createWallet(0);
  const state: { current: GameState } = { current: GameState.Playing };
  const boost = new BoostController(createBall(), state, wallet, gameConfig);
  charge(boost);
  expect(boost.tryBoost()).toEqual({ success: false, reason: "insufficient-energy" });
  expect(boost.hasCharge).toBe(true);
  wallet.addEnergy(5); expect(boost.tryBoost().success).toBe(true);
  state.current = GameState.Paused;
  charge(boost); expect(boost.chargeHits).toBe(0); expect(boost.hasCharge).toBe(false);
});
