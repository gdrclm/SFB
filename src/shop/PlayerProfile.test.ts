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
  expect(restored.activeMission).toBeNull();
  expect(restored.selectMission(1)).toBe(true);
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
  delete legacy.missionBoard;
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


it("saves exactly one chosen goal, progress and completion without silently pinning another", () => {
  const data = storage();
  let profile = new PlayerProfile(() => data);
  expect(profile.selectMission(2)).toBe(true);
  profile.applyMissionEvent({ type: "boost" });
  profile = new PlayerProfile(() => data);
  expect(profile.activeMission).toEqual({ index: 2, progress: 1 });
  expect(profile.selectMission(1)).toBe(true);
  profile.applyMissionEvent({ type: "coin" });
  expect(profile.selectMission(2)).toBe(true);
  expect(profile.activeMission?.progress).toBe(1);
  expect(profile.applyMissionEvent({ type: "boost" }).rewarded).toBe(true);
  expect(profile.activeMission).toBeNull();
  expect(profile.missionBoard.completed).toEqual([false, false, true, false, false]);
  expect(profile.coins).toBe(10);
  for (let i = 0; i < 12; i++) profile.applyMissionEvent({ type: "coin" });
  expect(profile.coins).toBe(10);
  expect(profile.selectMission(2)).toBe(false);
  profile = new PlayerProfile(() => data);
  expect(profile.activeMission).toBeNull();
  expect(profile.selectMission(1)).toBe(true);
  expect(profile.activeMission).toEqual({ index: 1, progress: 1 });
});

it("opens the next board only after all five rewards and leaves it unselected", () => {
  const data = storage(); const profile = new PlayerProfile(() => data);
  expect(profile.nextMissionBoard()).toBe(false);
  for (const index of [4, 2, 1, 0, 3]) {
    expect(profile.selectMission(index)).toBe(true);
    const type = index === 1 ? "coin" : index === 2 ? "boost" : "hit";
    for (let i = 1; i <= 15; i++) profile.applyMissionEvent(type === "hit" ? { type, combo: i } : { type });
    expect(profile.activeMission).toBeNull();
  }
  expect(profile.coins).toBe(50);
  expect(profile.missionBoard.completed.every(Boolean)).toBe(true);
  expect(profile.nextMissionBoard()).toBe(true);
  expect(profile.activeMission).toBeNull();
  expect(profile.missionBoard.start).toBe(5);
  expect(profile.selectMission(0)).toBe(false);
  expect(profile.selectMission(8)).toBe(true);
  expect(new PlayerProfile(() => data).activeMission).toEqual({ index: 8, progress: 0 });
});

it("preserves selection and the unpaid goal when saving selection or completion fails", () => {
  const data = storage(); let reject = false;
  const profile = new PlayerProfile(() => ({ getItem: data.getItem,
    setItem: (key, value) => { if (reject) throw Error("full"); data.setItem(key, value); } }));
  expect(profile.selectMission(2)).toBe(true);
  profile.applyMissionEvent({ type: "boost" });
  reject = true;
  expect(profile.selectMission(1)).toBe(false);
  expect(profile.activeMission).toEqual({ index: 2, progress: 1 });
  expect(profile.applyMissionEvent({ type: "boost" })).toEqual({ saved: false, rewarded: false });
  expect(profile.activeMission).toEqual({ index: 2, progress: 1 });
  expect(profile.missionBoard.completed[2]).toBe(false);
  reject = false;
  profile.applyMissionEvent({ type: "boost" });
  expect(new PlayerProfile(() => data).activeMission).toBeNull();
  expect(profile.coins).toBe(10);
});

it("migrates existing sequential goals and ignores invalid board selections", () => {
  const data = storage(); const original = new PlayerProfile(() => data);
  original.selectMission(1);
  const legacy = JSON.parse(data.getItem(PROFILE_KEY) ?? "{}") as Record<string, unknown>;
  legacy.mission = { index: 7, progress: 2 };
  delete legacy.missionBoard;
  data.setItem(PROFILE_KEY, JSON.stringify(legacy));
  const profile = new PlayerProfile(() => data);
  expect(profile.activeMission).toEqual({ index: 7, progress: 2 });
  expect(profile.missionBoard.completed).toEqual([true, true, false, false, false]);
  expect(profile.selectMission(6)).toBe(false);
  expect(profile.selectMission(7.5)).toBe(false);
  legacy.missionBoard = { start: 5, selected: 1, progress: [0, 0, 2, 0, 0], completed: [true, true, false, false, false] };
  data.setItem(PROFILE_KEY, JSON.stringify(legacy));
  expect(new PlayerProfile(() => data).activeMission).toEqual({ index: 7, progress: 2 });
});

it("buys a bounded combo-charge upgrade for the next run without granting a free BOOST", () => {
  const data = storage(); const profile = new PlayerProfile(() => data);
  profile.creditRuns([result("upgrade-funds", 500)]);
  expect(createPlayerConfig(gameConfig, profile).boost.comboHitsRequired).toBe(6);
  expect(profile.buy("combo-charge")).toBe(true);
  expect(profile.coins).toBe(400);
  expect(createPlayerConfig(gameConfig, profile).boost.comboHitsRequired).toBe(5);
  expect(profile.buy("combo-charge")).toBe(true);
  expect(profile.coins).toBe(200);
  expect(profile.buy("combo-charge")).toBe(false);
  expect(createPlayerConfig(gameConfig, new PlayerProfile(() => data)).boost.comboHitsRequired).toBe(4);
  expect(gameConfig.boost.comboHitsRequired).toBe(6);
});
