import { describe, expect, it, vi } from "vitest";
import { gameConfig } from "../config/gameConfig";
import { GameState, GameStateController } from "../core/GameStateController";
import { RunWallet } from "../currency/RunWallet";
import { SlowModeController } from "./SlowModeController";

function createController(energy = gameConfig.economy.initialEnergy): {
  controller: SlowModeController;
  gameState: GameStateController;
  wallet: RunWallet;
} {
  const gameState = new GameStateController();
  const wallet = new RunWallet(energy, gameConfig.economy.energyPerCoin);
  gameState.transitionTo(GameState.Playing);
  return {
    controller: new SlowModeController(gameState, wallet, gameConfig),
    gameState,
    wallet,
  };
}

describe("SlowModeController", () => {
  it("emits feedback only for real on/off transitions, including forced expiry", () => {
    const state = new GameStateController(); state.transitionTo(GameState.Playing);
    const notify = vi.fn();
    const controller = new SlowModeController(state, new RunWallet(30, 2), gameConfig, notify);
    controller.requestStart(); controller.update(0.5); controller.update(0.5);
    expect(notify).toHaveBeenCalledExactlyOnceWith(true);
    controller.requestStop(); controller.requestStop();
    controller.forceStart(3); controller.forceStart(3); controller.update(3);
    expect(notify.mock.calls).toEqual([[true], [false], [true], [false]]);
    controller.update(10); expect(notify).toHaveBeenCalledTimes(4);
  });

  it("toggles ten-percent game time on and off", () => {
    const { controller, gameState } = createController();

    expect(controller.toggle()).toBe(true);
    expect(gameState.current).toBe(GameState.SlowMode);
    expect(controller.timeScale).toBe(0.1);

    expect(controller.toggle()).toBe(false);

    expect(gameState.current).toBe(GameState.Playing);
    expect(controller.timeScale).toBe(1);
  });

  it("drains one energy after every three real seconds", () => {
    const { controller, wallet } = createController();
    controller.toggle();

    const firstTimeScale = controller.update(2.99);
    expect(wallet.energy).toBe(30);

    const secondTimeScale = controller.update(0.01);

    expect(wallet.energy).toBe(29);
    expect(controller.isActive).toBe(true);
    expect(firstTimeScale).toBe(0.1);
    expect(secondTimeScale).toBe(0.1);
  });

  it("stops when the energy reaches zero", () => {
    const { controller, gameState, wallet } = createController(1);
    controller.toggle();

    const timeScale = controller.update(3);

    expect(wallet.energy).toBe(0);
    expect(controller.isActive).toBe(false);
    expect(gameState.current).toBe(GameState.Playing);
    expect(timeScale).toBe(0.1);
  });

  it("requires one energy to activate", () => {
    const { controller, gameState } = createController(0.9);

    expect(controller.toggle()).toBe(false);
    expect(gameState.current).toBe(GameState.Playing);
  });

  it("cannot activate outside regular play", () => {
    const { controller, gameState } = createController();
    gameState.transitionTo(GameState.BounceRecovery);

    expect(controller.toggle()).toBe(false);
    expect(controller.timeScale).toBe(1);
  });

  it("forces slow mode without energy and cannot be switched off early", () => {
    const { controller, gameState, wallet } = createController(0);

    expect(controller.forceStart(3)).toBe(true);
    expect(controller.isForced).toBe(true);
    expect(controller.toggle()).toBe(true);
    expect(gameState.current).toBe(GameState.SlowMode);

    controller.update(2.99);
    expect(controller.isForced).toBe(true);
    expect(wallet.energy).toBe(0);

    controller.update(0.01);
    expect(controller.isForced).toBe(false);
    expect(controller.isActive).toBe(false);
    expect(gameState.current).toBe(GameState.Playing);
    expect(wallet.energy).toBe(0);
  });

  it("rejects an invalid forced duration", () => {
    const { controller } = createController();

    expect(() => controller.forceStart(0)).toThrow(RangeError);
    expect(() => controller.forceStart(Number.NaN)).toThrow(RangeError);
  });
});
