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

it("saves the first-success reward immediately and credits it once across reloads", () => {
  const data = storage(); const profile = new PlayerProfile(() => data);
  expect(profile.firstSuccessAt).toBeNull();
  expect(profile.completeFirstSuccess()).toBe(true);
  expect(profile.coins).toBe(25);
  const restored = new PlayerProfile(() => data);
  expect(restored.firstSuccessAt).toBe(profile.firstSuccessAt);
  expect(restored.completeFirstSuccess()).toBe(true);
  expect(restored.coins).toBe(25);
  restored.creditRuns([result("after-goal", 3)]);
  expect(restored.coins).toBe(28);
});

it("does not mark a reward saved when storage rejects the transaction", () => {
  const profile = new PlayerProfile(() => ({ getItem: () => null, setItem: () => { throw Error("full"); } }));
  expect(profile.completeFirstSuccess()).toBe(false);
  expect(profile.firstSuccessAt).toBeNull();
  expect(profile.coins).toBe(0);
});
