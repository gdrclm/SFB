import { expect, it } from "vitest";
import { gameConfig } from "../config/gameConfig";
import { createPlayerConfig, PlayerProfile, PROFILE_KEY, SHOP_ITEMS } from "./PlayerProfile";
import type { RunResult } from "../run/RunHistory";
function setup() {
  const data = new Map<string, string>();
  const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } };
  const profile = new PlayerProfile(() => storage);
  const run: RunResult = { id: "real", coins: 1000, depth: 10, platforms: 1, score: 1000, outcome: "completed", finishedAt: "2026-10-22T00:00:00Z" };
  profile.creditRuns([run]); profile.buy("ball-gold"); profile.equip("ball-gold"); profile.buy("energy");
  return { data, storage, profile, run };
}
it("restores the exact real balance, equipment, upgrades and missions without writing sandbox changes", () => {
  const { data, profile, run } = setup();
  const original = data.get(PROFILE_KEY);
  const balance = profile.coins;
  profile.setDeveloperMode(true);
  expect(profile.coins).toBe(0); expect(profile.level("energy")).toBe(0); expect(profile.owns("ball-gold")).toBe(false);
  for (const item of SHOP_ITEMS.filter(item => item.price > 0)) {
    expect(profile.price(item)).toBe(0);
    expect(profile.toggleDeveloperItem(item.id)).toBe(true);
    if (item.maxLevel !== undefined) expect(profile.level(item.id)).toBe(item.maxLevel);
    else expect(profile.owns(item.id)).toBe(true);
  }
  profile.selectMission(0); profile.applyMissionEvent({ type: "coin" });
  profile.creditRuns([{ ...run, id: "should-not-credit", coins: 50000 }]);
  expect(profile.coins).toBe(0); expect(data.get(PROFILE_KEY)).toBe(original);
  profile.setDeveloperMode(false);
  expect(profile.coins).toBe(balance); expect(profile.equipment.ball).toBe("ball-gold"); expect(profile.level("energy")).toBe(1);
  expect(profile.owns("plasma")).toBe(false); expect(data.get(PROFILE_KEY)).toBe(original);
  profile.setDeveloperMode(true);
  expect(profile.coins).toBe(0); expect(profile.level("energy")).toBe(0); expect(profile.owns("plasma")).toBe(false);
});
it("repeated clicks remove upgrades and purchases, and safely restore baseline slots", () => {
  const { profile } = setup(); profile.setDeveloperMode(true);
  for (const id of ["energy", "danger-scanner", "impact-retention", "annihilation", "plasma", "ball-gold", "world-night", "props-lanterns", "vfx-sparkles"]) {
    expect(profile.toggleDeveloperItem(id)).toBe(true);
    expect(profile.toggleDeveloperItem(id)).toBe(true);
    expect(profile.level(id)).toBe(0); expect(profile.owns(id)).toBe(false);
  }
  expect(profile.activeAbility).toBe("slow"); expect(profile.equipment.ball).toBe("ball-classic");
  expect(createPlayerConfig(gameConfig, profile).powers).toEqual(gameConfig.powers);
  expect(profile.toggleDeveloperItem("slow")).toBe(false);
  profile.setDeveloperMode(false); expect(profile.toggleDeveloperItem("plasma")).toBe(false);
});
it("a reload reads only the untouched real profile, and starts a clean developer overlay", () => {
  const { profile, storage } = setup(); const balance = profile.coins;
  profile.setDeveloperMode(true); profile.toggleDeveloperItem("plasma");
  const reloaded = new PlayerProfile(() => storage);
  expect(reloaded.coins).toBe(balance); expect(reloaded.owns("plasma")).toBe(false);
  reloaded.setDeveloperMode(true); expect(reloaded.coins).toBe(0); expect(reloaded.owns("plasma")).toBe(false);
});
it("keeps both abilities owned while equipping exactly one for the next run", () => {
  const { profile } = setup(); profile.setDeveloperMode(true);
  profile.toggleDeveloperItem("annihilation"); profile.toggleDeveloperItem("plasma");
  expect(profile.activeAbility).toBe("slow");
  expect(profile.equip("annihilation")).toBe(true);
  let config = createPlayerConfig(gameConfig, profile);
  expect(config.powers.annihilation).toBe(true); expect(config.powers.plasma).toBe(false);
  expect(profile.owns("plasma")).toBe(true);
  profile.equip("plasma"); config = createPlayerConfig(gameConfig, profile);
  expect(config.powers.annihilation).toBe(false); expect(config.powers.plasma).toBe(true);
  profile.equip("slow"); config = createPlayerConfig(gameConfig, profile);
  expect(config.powers.annihilation).toBe(false); expect(config.powers.plasma).toBe(false);
  expect(profile.owns("annihilation")).toBe(true); expect(profile.owns("plasma")).toBe(true);
});
