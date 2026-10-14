import { describe, expect, it, vi } from "vitest";
import { gameConfig } from "../config/gameConfig";
import { PhaseOneController } from "./PhaseOneController";

const expectedDurations = [40, 36, 32, 29, 26, 24, 21, 19, 17, 15];
const expectedStrengthRanges = [
  [7, 9],
  [9, 11],
  [11, 13],
  [13, 15],
  [15, 18],
  [18, 21],
  [21, 24],
  [24, 28],
  [28, 32],
  [32, 36],
];

describe("PhaseOneController", () => {
  it("contains the ten GDD stages and a roughly 4:20 phase", () => {
    const controller = new PhaseOneController(gameConfig);

    expect(gameConfig.phaseOne.stages.map((stage) => stage.durationSeconds)).toEqual(
      expectedDurations,
    );
    expect(
      gameConfig.phaseOne.stages.map((stage) => [
        stage.platformStrength.minimum,
        stage.platformStrength.maximum,
      ]),
    ).toEqual(expectedStrengthRanges);
    expect(controller.totalDurationSeconds).toBe(259);
    expect(controller.totalDurationSeconds).toBeGreaterThan(120);
  });

  it("keeps the relaxed first stage active for forty game seconds", () => {
    const controller = new PhaseOneController(gameConfig);
    const listener = vi.fn<(stageNumber: number) => void>();
    controller.onStageChanged(listener);

    controller.fixedUpdate(39.999);
    expect(controller.currentStageNumber).toBe(1);
    expect(controller.currentDifficulty.platformStrength).toBeCloseTo(9, 3);

    controller.fixedUpdate(0.001);
    expect(controller.currentStageNumber).toBe(2);
    expect(controller.currentDifficulty.platformStrength).toBe(9);
    expect(controller.currentDifficulty.reactionWindowSeconds).toBe(1.55);
    expect(listener).toHaveBeenCalledWith(2);
  });

  it("ramps strength up and reaction time down without an abrupt first-stage jump", () => {
    const controller = new PhaseOneController(gameConfig);

    expect(controller.currentDifficulty).toEqual({
      stageNumber: 1,
      platformStrength: 7,
      reactionWindowSeconds: 1.8,
    });

    controller.fixedUpdate(20);

    expect(controller.currentDifficulty.platformStrength).toBe(8);
    expect(controller.currentDifficulty.reactionWindowSeconds).toBeCloseTo(1.675, 10);
  });

  it("passes all ten stages and emits completion once", () => {
    const controller = new PhaseOneController(gameConfig);
    const completed = vi.fn();
    controller.onCompleted(completed);

    controller.fixedUpdate(controller.totalDurationSeconds);
    controller.fixedUpdate(10);

    expect(controller.currentStageNumber).toBe(10);
    expect(controller.isComplete).toBe(true);
    expect(controller.phaseElapsedSeconds).toBe(259);
    expect(controller.currentDifficulty.platformStrength).toBe(36);
    expect(controller.currentDifficulty.reactionWindowSeconds).toBe(0.45);
    expect(completed).toHaveBeenCalledOnce();
  });

  it("shortens later stages by approximately ten percent", () => {
    for (let index = 1; index < expectedDurations.length; index += 1) {
      const previous = expectedDurations[index - 1];
      const current = expectedDurations[index];
      if (previous === undefined || current === undefined) {
        throw new Error("Expected duration is missing.");
      }
      expect(current / previous).toBeGreaterThanOrEqual(0.85);
      expect(current / previous).toBeLessThanOrEqual(0.93);
    }
    expect(
      expectedDurations.slice(0, 4).reduce((total, value) => total + value, 0),
    ).toBeGreaterThan(120);
  });

  it("keeps every stage boundary continuous while increasing difficulty", () => {
    const stages = gameConfig.phaseOne.stages;

    for (let index = 1; index < stages.length; index += 1) {
      const previous = stages[index - 1];
      const current = stages[index];
      if (previous === undefined || current === undefined) {
        throw new Error("Expected phase stage is missing.");
      }

      expect(current.platformStrength.minimum).toBe(previous.platformStrength.maximum);
      expect(current.reactionWindowSeconds.maximum).toBe(
        previous.reactionWindowSeconds.minimum,
      );
    }
  });
});
