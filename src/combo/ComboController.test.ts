import { describe, expect, it } from "vitest";
import { gameConfig } from "../config/gameConfig";
import { PhaseOneController } from "../progression/PhaseOneController";
import { RunHistory, RunProgress } from "../run/RunHistory";
import { assessRisk, ComboController } from "./ComboController";

describe("combo scoring", () => {
  it("raises the multiplier at 3, 6, 10 and 15 hits and caps it at five", () => {
    const combo = new ComboController();
    const expected = new Map([[1, 1], [3, 2], [6, 3], [10, 4], [15, 5], [30, 5]]);
    for (let hit = 1; hit <= 30; hit++) {
      const reward = combo.hit(10, 7);
      if (expected.has(hit)) expect(reward.multiplier).toBe(expected.get(hit));
      expect(reward.points).toBe(25 * reward.multiplier);
    }
    expect(combo.best).toBe(30);
    expect(combo.nextThreshold).toBeNull();
    expect(combo.progress).toBe(1);
  });

  it("rewards high speed and a successful hit near the strength limit", () => {
    const safe = new ComboController().hit(40, 10);
    const risky = new ComboController().hit(40, 38);
    expect(safe.points).toBe(37);
    expect(risky.points).toBe(56);
    expect(risky.risky).toBe(true);
    expect(assessRisk(9, 10)).toBe("blocked");
    expect(() => new ComboController().hit(9, 10)).toThrow(RangeError);
  });

  it("loses the chain on an error while keeping best chain and earned bonus", () => {
    const combo = new ComboController();
    for (let i = 0; i < 6; i++) combo.hit(35, 30);
    const bonus = combo.bonus;
    expect(combo.miss()).toBe(6);
    expect(combo.count).toBe(0);
    expect(combo.multiplier).toBe(1);
    expect(combo.best).toBe(6);
    expect(combo.bonus).toBe(bonus);
    expect(combo.hit(10, 7).points).toBe(25);
  });

  it("runs the full five-minute progression and saves only earned bonus once", () => {
    const phase = new PhaseOneController(gameConfig);
    const combo = new ComboController();
    let totalPoints = 0;
    let platforms = 0;
    for (let frame = 1; frame <= 18000; frame++) {
      phase.fixedUpdate(1 / 60);
      if (frame % 120 === 0) {
        totalPoints += combo.hit(40, frame % 240 === 0 ? 38 : 15).points;
        platforms++;
      }
      if (frame % 3600 === 0) combo.miss();
    }
    expect(phase.isComplete).toBe(true);
    expect(phase.currentStageNumber).toBe(10);
    expect(phase.phaseElapsedSeconds).toBeCloseTo(300, 7);
    expect(combo.bonus).toBe(totalPoints - platforms * 25);
    const data = new Map<string, string>();
    const storage = { getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => { data.set(key, value); } };
    const history = new RunHistory(() => storage);
    const progress = new RunProgress();
    progress.observeDepth(100);
    const result = progress.finish(history, 5, platforms, "completed", combo);
    expect(result.score).toBe(150 + totalPoints);
    expect(result.bestCombo).toBe(combo.best);
    expect(new RunHistory(() => storage).top()[0]).toEqual(result);
    expect(progress.finish(history, 5, platforms, "interrupted", combo)).toBe(result);
  });
});
