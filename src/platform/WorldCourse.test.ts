import { expect, it } from "vitest";
import { atStartDepth } from "../dev/DeveloperMode";
import { gameConfig } from "../config/gameConfig";
import { PlatformRoutePlanner, type PlannedPlatform } from "./PlatformRoutePlanner";
function plansAt(depth: number, count = 50, speed = 20) {
  const config = atStartDepth(gameConfig, depth);
  const planner = new PlatformRoutePlanner(config.ball.startPosition.y, config, () => .3);
  return Array.from({ length: count }, () => planner.planNext(speed, 3, { stageNumber: 7, platformStrength: speed, reactionWindowSeconds: .8 }));
}
function members(plan: PlannedPlatform) { return [{ ...plan, yOffset: 0 }, ...(plan.choices ?? [])]; }
it("varies the physical course from a wide cascade to a winding combo route and optional risky branches", () => {
  const intro = plansAt(600).filter(p => p.section === "cascade" && p.worldPhase === "introduction");
  const middle = plansAt(1400).filter(p => p.section === "cascade" && p.worldPhase === "development");
  const peak = plansAt(2400).filter(p => p.section === "cascade" && p.worldPhase === "climax");
  expect(intro.length).toBeGreaterThanOrEqual(8);
  expect(middle.length).toBeGreaterThanOrEqual(10);
  expect(peak.length).toBeGreaterThanOrEqual(12);
  expect(intro.every(p => p.cascadeVariant === "wide")).toBe(true);
  expect(middle.every(p => p.cascadeVariant === "winding")).toBe(true);
  expect(peak.every(p => p.cascadeVariant === "risky")).toBe(true);
  expect(Math.min(...intro.map(p => p.passage?.width ?? 0))).toBeGreaterThan(Math.max(...middle.map(p => p.passage?.width ?? 0)));
  expect(intro.every(p => members(p).every(m => m.routeKind === "mandatory"))).toBe(true);
  expect(peak.some(p => members(p).some(m => m.routeKind === "boost") && (p.coinTrail?.count ?? 0) >= 7)).toBe(true);
  expect(middle.some(p => p.lateralMotion)).toBe(true);
});
it("combines several recognizable tests in a climax and always gives a recovery section afterwards", () => {
  const plans = plansAt(25000, 60);
  const climax = plans.filter(p => p.section === "climax");
  expect(new Set(climax.map(p => p.encounterTheme)).size).toBeGreaterThanOrEqual(4);
  const exit = plans.findIndex((p, index) => index > 0 && p.section !== "climax" && plans[index - 1]?.section === "climax");
  expect(plans[exit]?.section).toBe("breather");
  expect(plans.filter(p => p.section === "breather").every(p => members(p).every(m => m.strength <= 20 && m.kind !== "super-heavy"))).toBe(true);
});
it.each([20, 50, 160, 600])("keeps every course passable at %s speed, including the full sweep of moving groups", speed => {
  for (const depth of [600, 1400, 2500, 3500, 6000, 10000, 13000, 18000, 25000]) {
    const plans = plansAt(depth, 50, speed);
    let previous: PlannedPlatform | undefined;
    for (const plan of plans) {
      const passage = plan.passage;
      if (!passage) throw Error("Missing clear passage");
      const amplitude = plan.lateralMotion?.amplitude ?? 0;
      for (const m of members(plan)) for (const shift of [-amplitude, 0, amplitude]) {
        const width = m.widthScale * 7.5;
        expect(width).toBeGreaterThan(.6); expect(width).toBeLessThanOrEqual(5.4);
        expect(Math.abs(m.x + shift) + width / 2).toBeLessThanOrEqual(5.00001);
        expect(Math.abs(m.x + shift - passage.x) - width / 2).toBeGreaterThanOrEqual(passage.width / 2 - .00001);
      }
      if (previous?.passage) {
        const seconds = (previous.y - (previous.bandDepth ?? 0) - plan.y - 1.75) / (speed / 3);
        expect(seconds + .00001).toBeGreaterThanOrEqual(.24 + Math.abs(passage.x - previous.passage.x) / 16);
      }
      previous = plan;
    }
  }
});
it.each([600, 1400, 2500, 3500, 13000])("uses the actual start depth at %s metres on a developer start or fresh planner", depth => {
  const config = atStartDepth(gameConfig, depth);
  expect(config.startDepth).toBe(depth);
  const plans = plansAt(depth, 1);
  expect(plans[0]?.location).toBe(depth < 3000 ? "crystal" : depth < 12000 ? "lava" : "abyss");
  expect(plans[0]?.worldPhase).toBe(depth === 1400 ? "development" : depth === 2500 ? "climax" : "introduction");
});
