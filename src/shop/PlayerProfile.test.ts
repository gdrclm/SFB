import { describe, expect, it } from "vitest";
import { gameConfig } from "../config/gameConfig";
import type { RunResult } from "../run/RunHistory";
import { createPlayerConfig, PlayerProfile, PROFILE_KEY } from "./PlayerProfile";

function storage() {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); } };
}
const result = (id: string, coins: number): RunResult => ({
  id, coins, depth: 10, score: 10 + coins * 10, platforms: 0,
  outcome: "interrupted", finishedAt: "2026-10-20T00:00:00Z",
});

describe("player profile and shop", () => {
  it("credits historical and new runs once, including after reload", () => {
    const data = storage();
    const profile = new PlayerProfile(() => data);
    profile.creditRuns([result("a", 30), result("a", 30), result("b", 20)]);
    expect(profile.coins).toBe(50);
    const restored = new PlayerProfile(() => data);
    restored.creditRuns([result("a", 30), result("c", 5)]);
    expect(restored.coins).toBe(55);
  });

  it("rejects overspending and duplicate purchases, and persists equipment", () => {
    const data = storage(); const profile = new PlayerProfile(() => data);
    expect(profile.buy("ball-gold")).toBe(false);
    expect(profile.equip("ball-gold")).toBe(false);
    profile.creditRuns([result("a", 150)]);
    expect(profile.buy("ball-gold")).toBe(true);
    expect(profile.buy("ball-gold")).toBe(false);
    expect(profile.coins).toBe(100);
    expect(profile.equip("ball-gold")).toBe(true);
    const restored = new PlayerProfile(() => data);
    expect(restored.equipment.ball).toBe("ball-gold");
    expect(createPlayerConfig(gameConfig, restored).ballVisual.baseColor.r).toBe(1);
    expect(profile.equip("not-an-item")).toBe(false);
  });

  it("prices upgrade levels, caps them, and applies them without changing base config", () => {
    const profile = new PlayerProfile(() => storage());
    profile.creditRuns([result("a", 1000)]);
    for (let i = 0; i < 5; i++) expect(profile.buy("energy")).toBe(true);
    expect(profile.buy("energy")).toBe(false);
    expect(profile.coins).toBe(625);
    expect(profile.buy("coin-energy")).toBe(true);
    const config = createPlayerConfig(gameConfig, profile);
    expect(config.economy.initialEnergy).toBe(55);
    expect(config.economy.energyPerCoin).toBe(3);
    expect(gameConfig.economy.initialEnergy).toBe(30);
    expect(gameConfig.economy.energyPerCoin).toBe(2);
  });

  it("does not deduct coins or grant purchases when storage writes fail", () => {
    const data = storage(); const profile = new PlayerProfile(() => data);
    profile.creditRuns([result("a", 100)]);
    data.setItem = () => { throw new Error("Quota exceeded"); };
    expect(profile.buy("ball-gold")).toBe(false);
    expect(profile.coins).toBe(100);
    expect(profile.owns("ball-gold")).toBe(false);
    expect(profile.storageAvailable).toBe(false);
  });

  it("protects corrupt profiles from being overwritten by purchases", () => {
    const data = storage(); data.setItem(PROFILE_KEY, '{"coins":-100}');
    const profile = new PlayerProfile(() => data);
    expect(profile.creditRuns([result("a", 200)])).toBe(false);
    expect(profile.buy("energy")).toBe(false);
    expect(data.getItem(PROFILE_KEY)).toBe('{"coins":-100}');
  });
});

it("atomically saves each mission reward and next goal across reloads without double credit", () => {
  const data = storage(); const profile = new PlayerProfile(() => data);
  for (let i = 1; i <= 5; i++) profile.applyMissionEvent({ type: "hit", combo: i });
  expect(profile.coins).toBe(10);
  expect(profile.mission).toEqual({ index: 1, progress: 0 });
  const restored = new PlayerProfile(() => data);
  expect(restored.mission).toEqual(profile.mission);
  restored.applyMissionEvent({ type: "hit", combo: 6 });
  expect(restored.coins).toBe(10);
  for (let i = 0; i < 5; i++) restored.applyMissionEvent({ type: "coin" });
  expect(restored.coins).toBe(20);
  expect(new PlayerProfile(() => data).mission).toEqual({ index: 2, progress: 0 });
  restored.creditRuns([result("after-goal", 5), result("after-goal", 5)]);
  expect(restored.coins).toBe(25);
});

it("migrates a completed legacy first goal without another reward or a stuck completed banner", () => {
  const data = storage(); const profile = new PlayerProfile(() => data);
  profile.creditRuns([result("legacy", 25)]);
  const legacy = JSON.parse(data.getItem(PROFILE_KEY) ?? "{}") as Record<string, unknown>;
  legacy.firstSuccessAt = "2026-10-20T00:00:00Z";
  delete legacy.mission;
  data.setItem(PROFILE_KEY, JSON.stringify(legacy));
  const restored = new PlayerProfile(() => data);
  expect(restored.coins).toBe(25);
  expect(restored.mission).toEqual({ index: 1, progress: 0 });
  restored.applyMissionEvent({ type: "run-start" });
  expect(restored.coins).toBe(25);
});

it("keeps partial progress across reloads and grants nothing on rejected saves", () => {
  const data = storage(); let reject = false;
  const profile = new PlayerProfile(() => ({ getItem: data.getItem,
    setItem: (key, value) => { if (reject) throw Error("full"); data.setItem(key, value); } }));
  for (let i = 1; i <= 4; i++) profile.applyMissionEvent({ type: "hit", combo: i });
  expect(new PlayerProfile(() => data).mission.progress).toBe(4);
  reject = true;
  expect(profile.applyMissionEvent({ type: "hit", combo: 5 })).toEqual({ saved: false, rewarded: false });
  expect(profile.coins).toBe(0);
  expect(profile.mission).toEqual({ index: 0, progress: 4 });
  reject = false;
  expect(profile.applyMissionEvent({ type: "hit", combo: 6 })).toEqual({ saved: true, rewarded: true });
  expect(profile.coins).toBe(10);
  expect(new PlayerProfile(() => data).coins).toBe(10);
});
