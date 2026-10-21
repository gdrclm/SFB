import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { Scene } from "@babylonjs/core/scene";
import { describe, expect, it, vi } from "vitest";
import { gameConfig } from "../config/gameConfig";
import { RunWallet } from "../currency/RunWallet";
import { CoinCollectionController } from "./CoinCollectionController";
import { CoinController } from "./CoinController";

describe("CoinCollectionController", () => {
  it("collects a coin crossed during one high-speed step", () => {
    const engine = new NullEngine();
    const scene = new Scene(engine);
    const coin = new CoinController(scene, gameConfig, { x: 0, y: 0 }, 0);
    const ball = {
      previousPosition: { x: 0, y: 2, z: 0 },
      position: { x: 0, y: -2, z: 0 },
      fallSpeed: gameConfig.ball.startFallSpeed,
    };
    const wallet = new RunWallet(
      gameConfig.economy.initialEnergy,
      gameConfig.economy.energyPerCoin,
    );
    const controller = new CoinCollectionController(
      ball,
      [coin],
      wallet,
      gameConfig,
    );
    const listener = vi.fn();
    controller.onCollected(listener);

    controller.fixedUpdate(1 / 60);
    controller.fixedUpdate(1 / 60);

    expect(coin.isActive).toBe(false);
    expect(wallet.coins).toBe(1);
    expect(wallet.energy).toBe(
      gameConfig.economy.initialEnergy + gameConfig.economy.energyPerCoin,
    );
    expect(ball.fallSpeed).toBe(
      gameConfig.ball.startFallSpeed + gameConfig.economy.speedPerCoin,
    );
    expect(listener).toHaveBeenCalledOnce();

    controller.dispose();
    scene.dispose();
    engine.dispose();
  });

  it("does not collect a coin outside the ball path", () => {
    const engine = new NullEngine();
    const scene = new Scene(engine);
    const coin = new CoinController(scene, gameConfig, { x: 3, y: 0 }, 0);
    const wallet = new RunWallet(30, 2);
    const controller = new CoinCollectionController(
      {
        previousPosition: { x: 0, y: 2, z: 0 },
        position: { x: 0, y: -2, z: 0 },
        fallSpeed: gameConfig.ball.startFallSpeed,
      },
      [coin],
      wallet,
      gameConfig,
    );

    controller.fixedUpdate(1 / 60);

    expect(coin.isActive).toBe(true);
    expect(wallet.coins).toBe(0);

    controller.dispose();
    scene.dispose();
    engine.dispose();
  });
});

it("annihilation credits each coin in the actual circular radius once and immediately increases speed", () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  const coins = [new CoinController(scene, gameConfig, { x: 0, y: -200 }, 0), new CoinController(scene, gameConfig, { x: 1, y: -200 }, 1)];
  const ball = { position: { x: 0, y: 0, z: 0 }, previousPosition: { x: 0, y: 0, z: 0 }, fallSpeed: 10 };
  const wallet = new RunWallet(30, 2), controller = new CoinCollectionController(ball, coins, wallet, gameConfig);
  const listener = vi.fn(); controller.onCollected(listener);
  controller.collectWithin(ball.position, 200); controller.collectWithin(ball.position, 200);
  expect(wallet.coins).toBe(1); expect(ball.fallSpeed).toBe(11);
  expect(coins[1]?.isActive).toBe(true);
  expect(listener).toHaveBeenCalledWith(coins[0], true);
  controller.dispose(); scene.dispose(); engine.dispose();
});

it("mini annihilation attracts visible coins while leaving offscreen coins for later pulses", () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  const coins = [new CoinController(scene, gameConfig, { x: 0, y: -5 }, 0), new CoinController(scene, gameConfig, { x: 0, y: -30 }, 1)];
  const ball = { position: { x: 0, y: 0, z: 0 }, previousPosition: { x: 0, y: 0, z: 0 }, fallSpeed: 10 };
  const wallet = new RunWallet(30, 2), controller = new CoinCollectionController(ball, coins, wallet, gameConfig);
  const listener = vi.fn(); controller.onCollected(listener);
  controller.collectInScreen({ left: -5, right: 5, bottom: -10, top: 2 });
  expect(wallet.coins).toBe(1); expect(ball.fallSpeed).toBe(11);
  expect(coins[1]?.isActive).toBe(true);
  expect(listener).toHaveBeenCalledWith(coins[0], true);
  controller.dispose(); scene.dispose(); engine.dispose();
});
