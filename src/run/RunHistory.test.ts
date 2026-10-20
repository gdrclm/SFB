import { describe, expect, it } from "vitest";
import { calculateScore, RUN_HISTORY_KEY, RunHistory, RunProgress } from "./RunHistory";

function createStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
  };
}

describe("run records", () => {
  it("saves the maximum depth, scoring and outcome across reloads, exactly once", () => {
    const storage = createStorage();
    const history = new RunHistory(() => storage);
    const run = new RunProgress();
    run.observeDepth(15.8);
    run.observeDepth(12);
    const result = run.finish(history, 2, 3, "completed");
    run.observeDepth(100);
    expect(run.finish(history, 5, 10, "interrupted")).toBe(result);
    expect(result).toMatchObject({ depth: 15, coins: 2, platforms: 3, score: 110, outcome: "completed" });
    expect(new RunHistory(() => storage).top()).toEqual([result]);
  });

  it("retains interrupted runs and ranks scores, then depth, in the top ten", () => {
    const storage = createStorage();
    const history = new RunHistory(() => storage);
    for (let i = 0; i < 12; i++) {
      const run = new RunProgress();
      run.observeDepth(i);
      run.finish(history, 0, 0, "interrupted");
    }
    expect(history.top().map((run) => run.depth)).toEqual([11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
    expect(history.top(20)).toHaveLength(12);
    expect(new RunHistory(() => storage).top()[0]?.outcome).toBe("interrupted");
    expect(calculateScore(3.9, 2, 1)).toBe(48);
  });

  it("loads earlier records without combo fields without changing their score", () => {
    const storage = createStorage();
    storage.setItem(RUN_HISTORY_KEY, JSON.stringify([{ id: "old", finishedAt: "2026-10-20T00:00:00Z",
      depth: 10, coins: 2, platforms: 1, score: 55, outcome: "completed" }]));
    expect(new RunHistory(() => storage).top()[0]?.score).toBe(55);
  });

  it("filters corrupt entries and survives invalid JSON or unavailable storage", () => {
    const storage = createStorage();
    storage.setItem(RUN_HISTORY_KEY, '[null,{}, {"score": -1}]');
    expect(new RunHistory(() => storage).top()).toEqual([]);
    storage.setItem(RUN_HISTORY_KEY, '{');
    const history = new RunHistory(() => storage);
    expect(history.top()).toEqual([]);
    const unavailable = new RunHistory(() => { throw new Error("Storage blocked"); });
    new RunProgress().finish(unavailable, 0, 0, "completed");
    expect(unavailable.top()).toHaveLength(1);
    expect(unavailable.storageAvailable).toBe(false);
  });
});

it("persists peak speed through slowdown, bounce and reload, and freezes on finish", () => {
  const storage = createStorage(); const history = new RunHistory(() => storage);
  const run = new RunProgress();
  for (const speed of [10, 22.59, 15, NaN, Infinity, -1]) run.observeSpeed(speed);
  const result = run.finish(history, 2, 5, "completed");
  run.observeSpeed(100);
  expect(result.maxSpeed).toBe(22.6);
  expect(new RunHistory(() => storage).all()[0]?.maxSpeed).toBe(22.6);
  expect(run.finish(history, 0, 0, "interrupted")).toBe(result);
});

it("keeps independent depth, speed and stage records across runs and reloads", () => {
  const storage = createStorage(); const history = new RunHistory(() => storage);
  const deep = new RunProgress(); deep.observeDepth(500); deep.observeSpeed(15); deep.observeStage(4);
  deep.finish(history, 0, 0, "completed");
  const fast = new RunProgress(); fast.observeDepth(40); fast.observeSpeed(70); fast.observeStage(2);
  fast.finish(history, 100, 10, "interrupted");
  expect(new RunHistory(() => storage).personalBests()).toEqual({ depth: 500, maxSpeed: 70, stage: 4 });
});
