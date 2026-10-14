import { describe, expect, it } from "vitest";
import { GameState, GameStateController } from "./GameStateController";

describe("GameStateController", () => {
  it("starts in loading state", () => {
    expect(new GameStateController().current).toBe(GameState.Loading);
  });

  it("stores an explicitly requested state", () => {
    const controller = new GameStateController();
    controller.transitionTo(GameState.Playing);

    expect(controller.current).toBe(GameState.Playing);
  });

  it("stores paused state separately from gameplay", () => {
    const controller = new GameStateController();
    controller.transitionTo(GameState.Playing);
    controller.transitionTo(GameState.Paused);

    expect(controller.current).toBe(GameState.Paused);
  });
});
