import { expect, it } from "vitest";
import { atStartDepth } from "../dev/DeveloperMode";
import { gameConfig } from "../config/gameConfig";
import { PlatformRoutePlanner, type PlannedPlatform } from "./PlatformRoutePlanner";
function plansAt(depth: number, count = 50, speed = 20, reactionWindowSeconds = .8) {
  const config = atStartDepth(gameConfig, depth);
  const planner = new PlatformRoutePlanner(config.ball.startPosition.y, config, () => .3);
  return Array.from({ length: count }, () => planner.planNext(speed, 3, { stageNumber: 7, platformStrength: speed, reactionWindowSeconds }));
}
function members(plan: PlannedPlatform) { return [{ ...plan, yOffset: 0 }, ...(plan.choices ?? [])]; }
function planAt(plans: readonly PlannedPlatform[], index: number): PlannedPlatform {
  const plan = plans[index];
  if (plan === undefined) throw new Error(`Missing course row ${String(index)}`);
  return plan;
}
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

it("opens with a steady eight-row phrase, repeats geometry in pairs and gives cascades a four-beat rhythm", () => {
  const plans = plansAt(0, 26);
  expect(plans.slice(0, 8).every(p => p.section === "run-up")).toBe(true);
  expect(plans.slice(8, 16).every(p => p.section === "cascade")).toBe(true);
  expect(plans.slice(16, 20).every(p => p.section === "breather")).toBe(true);
  for (let i = 0; i < 8; i += 2) {
    const a=planAt(plans,i), b=planAt(plans,i+1);
    expect(a.passage).toEqual(b.passage);
    expect(members(a).map(m => [m.x,m.widthScale,m.kind])).toEqual(members(b).map(m => [m.x,m.widthScale,m.kind]));
  }
  for (const plan of plans.slice(1, 8)) expect(plan.reactionWindowSeconds).toBeCloseTo(planAt(plans,0).reactionWindowSeconds, 8);
  const cascade = plans.slice(8, 16);
  expect(planAt(cascade,0).reactionWindowSeconds).toBeCloseTo(planAt(cascade,1).reactionWindowSeconds, 8);
  expect(planAt(cascade,1).reactionWindowSeconds).toBeCloseTo(planAt(cascade,2).reactionWindowSeconds, 8);
  expect(planAt(cascade,3).reactionWindowSeconds).toBeGreaterThan(planAt(cascade,2).reactionWindowSeconds);
  expect(planAt(cascade,7).reactionWindowSeconds).toBeCloseTo(planAt(cascade,3).reactionWindowSeconds, 8);
});

it("waits for the full phrase and recovery before a timed challenge, then adds a recovery afterwards", () => {
  const config = atStartDepth(gameConfig, 0);
  const planner = new PlatformRoutePlanner(config.ball.startPosition.y, config, () => .3);
  const difficulty = { stageNumber: 7, platformStrength: 20, reactionWindowSeconds: .8 };
  const plans = [planner.planNext(20, 3, difficulty), planner.planNext(20, 3, difficulty)];
  planner.scheduleEncounter("trap");
  planner.scheduleEncounter("chaos"); // No growing backlog or replacement of the announced request.
  for (let i=2;i<33;i++) plans.push(planner.planNext(20,3,difficulty));
  expect(plans.slice(0,20).every(p => !p.externalEncounter)).toBe(true);
  expect(plans.slice(16,20).every(p => p.section === "breather")).toBe(true);
  expect(plans[20]?.encounterTheme).toBe("trap");
  expect(plans[20]?.encounterRowIndex).toBe(0);
  expect(plans.slice(20,28).every(p => p.externalEncounter && p.encounterTheme === "trap")).toBe(true);
  expect(plans.slice(28,32).every(p => !p.externalEncounter && p.section === "breather")).toBe(true);
});

it("finishes a phrase across an internal difficulty threshold and develops the following one", () => {
  const plans = plansAt(150, 12);
  expect(plans.slice(0,8).every(p => p.section === "run-up" && p.worldPhase === "introduction")).toBe(true);
  expect(plans[8]?.worldPhase).toBe("development");
  expect(plans[8]?.section).toBe("cascade");
});

it("introduces shuttles, wind and turrets in authored pairs while keeping the opening clear",()=>{
  expect(plansAt(0,8).every(p=>!p.mechanic)).toBe(true);
  const plans=[600,1400,2400,6000,14000].flatMap(depth=>plansAt(depth,60));
  expect(plans.some(p=>p.mechanic==="moving" && (p.lateralMotion?.amplitude??0)>=.9)).toBe(true);
  expect(plans.some(p=>p.mechanic?.startsWith("wind"))).toBe(true);
  expect(plans.some(p=>p.mechanic==="turret")).toBe(true);
  for(const plan of plans.filter(p=>p.mechanic)) expect([2,3]).toContain(plan.section==="climax"?plan.encounterRowIndex%4:plan.encounterRowIndex);
});

it.each([[20,.8],[45,.8],[80,.8],[80,1.8]])("introduces every new mechanic near the crystal entrance during continuous play at %s speed with %s reaction time", (speed, reaction) => {
  const plans = plansAt(0, 400, speed, reaction);
  const entrance = plans.findIndex(p => p.location === "crystal");
  expect(entrance).toBeGreaterThan(0);
  const opening = plans.slice(entrance, entrance + 20);
  expect(opening[0]?.mechanic).toBeUndefined();
  expect(opening[1]?.mechanic).toBeUndefined();
  expect(opening[2]?.mechanic).toBe("moving");
  expect(opening[3]?.mechanic).toBe("moving");
  expect(opening[10]?.mechanic?.startsWith("wind")).toBe(true);
  expect(opening[18]?.mechanic).toBe("turret");
  for (const start of [4,12]) expect(opening.slice(start,start+4).every(p => p.section === "breather" && !p.mechanic)).toBe(true);
});

it("keeps timed challenges from replacing the three crystal introduction lessons", () => {
  const config = atStartDepth(gameConfig, 500);
  const planner = new PlatformRoutePlanner(config.ball.startPosition.y, config, () => .3);
  const plans: PlannedPlatform[] = [];
  for (let i = 0; i < 30; i++) {
    planner.scheduleEncounter("break-run");
    plans.push(planner.planNext(45, 3, { stageNumber: 7, platformStrength: 45, reactionWindowSeconds: .8 }));
  }
  expect(plans[2]?.mechanic).toBe("moving");
  expect(plans[10]?.mechanic?.startsWith("wind")).toBe(true);
  expect(plans[18]?.mechanic).toBe("turret");
  expect(plans.slice(0,24).every(p => !p.externalEncounter)).toBe(true);
  expect(plans[24]?.externalEncounter).toBe(true);
  expect(plans[24]?.encounterTheme).toBe("break-run");
});
