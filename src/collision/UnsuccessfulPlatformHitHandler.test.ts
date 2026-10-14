import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { describe, expect, it, vi } from "vitest";
import { gameConfig } from "../config/gameConfig";
import { GameState, GameStateController } from "../core/GameStateController";
import type { PlatformController } from "../platform/PlatformController";
import type { PlatformCollision } from "./CollisionResolver";
import { UnsuccessfulPlatformHitHandler } from "./UnsuccessfulPlatformHitHandler";

function createPlatform(): PlatformController {
  return {
    strength: 9,
    size: { width: 7.5, height: 0.6, depth: 1 },
    mesh: { position: new Vector3(0, -5, 0) },
  } as PlatformController;
}

describe("UnsuccessfulPlatformHitHandler", () => {
  it("starts one bounce, removes one life and protects against repeated hits", () => {
    const ball = {
      isBouncing: false,
      startBounce: vi.fn((contactY: number) => {
        ball.isBouncing = true;
        return Number.isFinite(contactY);
      }),
    };
    const state = new GameStateController();
    state.transitionTo(GameState.Playing);
    const lives = {
      remainingLives: 3,
      loseLife: vi.fn(() => {
        lives.remainingLives -= 1;
        return true;
      }),
    };
    const feedback = { playErrorReaction: vi.fn() };
    const handler = new UnsuccessfulPlatformHitHandler(
      ball,
      state,
      lives,
      feedback,
      gameConfig,
    );
    const platform = createPlatform();
    const collision: PlatformCollision = {
      platform,
      ballSpeed: 8,
      assessment: "insufficient",
    };

    expect(handler.handle(collision)).toBe(true);
    expect(ball.startBounce).toHaveBeenCalledWith(-4.2);
    expect(lives.loseLife).toHaveBeenCalledOnce();
    expect(feedback.playErrorReaction).toHaveBeenCalledWith(platform);
    expect(state.current).toBe(GameState.BounceRecovery);
    expect(handler.protectionRemainingSeconds).toBe(
      gameConfig.unsuccessfulHit.repeatProtectionSeconds,
    );

    expect(handler.handle(collision)).toBe(false);
    expect(lives.loseLife).toHaveBeenCalledOnce();

    ball.isBouncing = false;
    handler.fixedUpdate(gameConfig.unsuccessfulHit.bounceDurationSeconds);
    expect(state.current).toBe(GameState.Playing);
    expect(handler.handle(collision)).toBe(false);
    expect(lives.loseLife).toHaveBeenCalledOnce();
  });

  it("ignores a successful collision", () => {
    const ball = { isBouncing: false, startBounce: vi.fn(() => true) };
    const state = new GameStateController();
    state.transitionTo(GameState.Playing);
    const lives = { remainingLives: 3, loseLife: vi.fn(() => true) };
    const feedback = { playErrorReaction: vi.fn() };
    const handler = new UnsuccessfulPlatformHitHandler(
      ball,
      state,
      lives,
      feedback,
      gameConfig,
    );

    expect(
      handler.handle({
        platform: createPlatform(),
        ballSpeed: 10,
        assessment: "sufficient",
      }),
    ).toBe(false);
    expect(ball.startBounce).not.toHaveBeenCalled();
  });

  it("ends the run after the last life is lost", () => {
    const ball = {
      isBouncing: false,
      startBounce: vi.fn(() => true),
    };
    const state = new GameStateController();
    state.transitionTo(GameState.Playing);
    const lives = {
      remainingLives: 1,
      loseLife: vi.fn(() => {
        lives.remainingLives = 0;
        return true;
      }),
    };
    const handler = new UnsuccessfulPlatformHitHandler(
      ball,
      state,
      lives,
      { playErrorReaction: vi.fn() },
      gameConfig,
    );

    expect(
      handler.handle({
        platform: createPlatform(),
        ballSpeed: 8,
        assessment: "insufficient",
      }),
    ).toBe(true);
    expect(lives.remainingLives).toBe(0);
    expect(state.current).toBe(GameState.GameOver);

    ball.isBouncing = false;
    handler.fixedUpdate(1);
    expect(state.current).toBe(GameState.GameOver);
  });
});
