import { describe, expect, it } from "vitest";

import { gameConfig } from "./gameConfig";

describe("gameConfig speed and platform balance", () => {
  it("slows world movement without changing gameplay speed units", () => {
    expect(gameConfig.ball.startFallSpeed).toBe(10);
    expect(gameConfig.ball.movementScale).toBeCloseTo(1 / 3, 10);
    expect(gameConfig.boost.speedIncrease).toBe(5);
    expect(gameConfig.platforms.map(({ strength }) => strength)).toEqual([7, 8, 9]);
  });

  it("lets the starting ball destroy the first platform", () => {
    const firstPlatform = gameConfig.platforms[0];

    expect(firstPlatform).toBeDefined();
    expect(gameConfig.ball.startFallSpeed).toBeGreaterThanOrEqual(
      firstPlatform?.strength ?? Number.POSITIVE_INFINITY,
    );
  });

  it("uses the GDD coin and energy values", () => {
    expect(gameConfig.economy.initialEnergy).toBe(30);
    expect(gameConfig.economy.energyPerCoin).toBe(2);
    expect(gameConfig.economy.speedPerCoin).toBe(1);
    expect(gameConfig.coins.positions.length).toBeGreaterThan(0);
    expect(gameConfig.coins.richTrailCount).toBe(10);
    expect(gameConfig.coins.poolSize).toBeGreaterThan(
      gameConfig.coins.richTrailCount,
    );
  });

  it("uses the configured slow mode values", () => {
    expect(gameConfig.slowMode.timeScale).toBe(0.1);
    expect(gameConfig.slowMode.energyCost).toBe(1);
    expect(gameConfig.slowMode.energyIntervalRealSeconds).toBe(3);
  });

  it("keeps generated platforms inside the stage-one reaction window", () => {
    const firstStage = gameConfig.phaseOne.stages[0];
    const secondStage = gameConfig.phaseOne.stages[1];
    expect(secondStage?.reactionWindowSeconds.minimum).toBe(1.3);
    expect(firstStage?.reactionWindowSeconds.maximum).toBe(1.8);
    expect(gameConfig.platformGeneration.multiRowMinimumCount).toBe(2);
    expect(gameConfig.platformGeneration.multiRowMaximumCount).toBe(4);
    expect(gameConfig.platformGeneration.multiRowGap).toBeLessThan(
      gameConfig.ball.radius * 2,
    );
    expect(gameConfig.platformGeneration.poolSize).toBeGreaterThanOrEqual(
      gameConfig.platformGeneration.lookAheadCount *
        gameConfig.platformGeneration.multiRowMaximumCount,
    );
    expect(gameConfig.platformGeneration.encounterRows).toBe(4);
    expect(gameConfig.platformGeneration.extendedEncounterRows).toBe(5);
  });

  it("keeps special-platform effects configurable", () => {
    expect(gameConfig.platformEffects.vitalityLives).toBe(1);
    expect(gameConfig.platformEffects.vitalityEnergy).toBe(10);
    expect(gameConfig.platformEffects.forcedSlowDurationRealSeconds).toBe(3);
    expect(gameConfig.platformGeneration.choiceStartStage).toBe(2);
  });
});
