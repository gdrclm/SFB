import { describe, expect, it } from "vitest";
import { platformSpriteSlices, platformSpriteRect } from "./PlatformSpriteLayout";
import { gameConfig } from "../config/gameConfig";
import { PlatformRoutePlanner, type PlannedPlatform, type PlatformEncounterTheme } from "./PlatformRoutePlanner";

const themes: readonly PlatformEncounterTheme[] = ["chaos", "trap", "deception", "rich-lane", "danger-lane", "death-tunnel", "break-run"];
const difficulty = { stageNumber: 6, platformStrength: 12, reactionWindowSeconds: .8 };
function plannerFor(theme: PlatformEncounterTheme, variant = 0): PlatformRoutePlanner {
  const planner = new PlatformRoutePlanner(0, gameConfig, () => variant / 4);
  planner.queueEncounter(theme);
  return planner;
}
function members(plan: PlannedPlatform) {
  return [{ x: plan.x, yOffset: 0, widthScale: plan.widthScale, strength: plan.strength, kind: plan.kind, routeKind: plan.routeKind }, ...(plan.choices ?? [])];
}

describe("flight encounters", () => {
  it.each(themes)("leaves a clear, reachable winding passage through %s at every speed", theme => {
    for (const speed of [10, 20, 50, 160, 600]) for (let variant = 0; variant < 4; variant++) {
      const planner = plannerFor(theme, variant);
      let previous: PlannedPlatform | null = null;
      for (let i = 0; i < 18; i++) {
        const plan = planner.planNext(speed, i % 6, difficulty);
        const passage = plan.passage;
        if (!passage) throw new Error("Expected an open flight passage.");
        expect(passage.width).toBeGreaterThan(gameConfig.ball.radius * 2 + .5);
        let occupiedWidth = 0;
        for (const member of members(plan)) {
          const width = member.widthScale * 7.5;
          expect(width).toBeGreaterThan(.6);
          expect(width).toBeLessThanOrEqual(5.4);
          expect(Math.abs(member.x) + width / 2).toBeLessThanOrEqual(5);
          expect(Math.abs(member.x - passage.x) - width / 2).toBeGreaterThanOrEqual(passage.width / 2 - .00001);
          expect(member.yOffset ?? 0).toBeLessThanOrEqual(0);
          expect(member.yOffset ?? 0).toBeGreaterThanOrEqual(-(plan.bandDepth ?? 0));
          occupiedWidth += width;
        }
        expect(occupiedWidth).toBeLessThan(6.5);
        if (previous?.passage) {
          const clearance = gameConfig.ball.radius * 2 + .6 + .15;
          const travelSeconds = (previous.y - (previous.bandDepth ?? 0) - plan.y - clearance) / (speed * gameConfig.ball.movementScale);
          expect(travelSeconds + .00001).toBeGreaterThanOrEqual(.24 + Math.abs(passage.x - previous.passage.x) / gameConfig.ball.horizontalMaxSpeed);
        }
        previous = plan;
      }
    }
  });

  it.each(themes)("varies the rhythm, widths and elevations in %s instead of filling equal rows", theme => {
    const planner = plannerFor(theme);
    const plans = Array.from({ length: 12 }, () => planner.planNext(50, 0, difficulty));
    const spacings = plans.slice(1).map((plan, index) => Number(((plans[index]?.y ?? 0) - plan.y).toFixed(3)));
    expect(new Set(spacings).size).toBeGreaterThan(3);
    expect(new Set(plans.map(plan => plan.passage?.x)).size).toBeGreaterThan(3);
    expect(new Set(plans.flatMap(plan => members(plan).map(member => member.widthScale.toFixed(3)))).size).toBeGreaterThan(4);
    expect(plans.some(plan => (plan.choices ?? []).some(choice => (choice.yOffset ?? 0) < -.2))).toBe(true);
  });

  it("gives zones different geometry, not just different materials", () => {
    const signatures = themes.map(theme => {
      const planner = plannerFor(theme);
      return Array.from({ length: 4 }, () => {
        const plan = planner.planNext(30, 0, difficulty);
        return [plan.y, plan.passage?.x, members(plan).map(member => [member.x, member.yOffset, member.widthScale])];
      });
    });
    expect(new Set(signatures.map(signature => JSON.stringify(signature))).size).toBe(themes.length);
  });

  it("leads rich rewards along a bent route towards an optional BOOST island", () => {
    const planner = plannerFor("rich-lane");
    const plan = planner.planNext(50, 0, difficulty);
    const trail = plan.coinTrail;
    expect(trail?.x).toBe(plan.passage?.x);
    expect(trail?.endX).not.toBe(trail?.x);
    expect(trail?.curve).not.toBe(0);
    expect(trail?.count).toBe(10);
    const target = members(plan).find(member => member.x === trail?.endX);
    expect(target?.routeKind).toBe("boost");
    expect(target?.strength).toBeGreaterThan(50);
    expect(target?.strength).toBeLessThanOrEqual(75);
    expect(planner.planNext(50, 0, difficulty).coinTrail?.count).toBe(5);
  });

  it("offers a combo cascade of weak islands with breathing spaces and a free bypass", () => {
    const planner = plannerFor("break-run");
    const plans = Array.from({ length: 4 }, () => planner.planNext(50, 3, difficulty));
    expect(new Set(plans.map(plan => members(plan).length)).size).toBe(3);
    for (const plan of plans) for (const member of members(plan)) {
      expect(member.strength).toBeLessThanOrEqual(50);
      expect(member.kind).toBe("standard");
      expect(plan.passage?.width).toBeGreaterThan(2);
    }
  });

  it("keeps trap and tunnel danger above one BOOST, while leaving a physical opening", () => {
    for (const theme of ["trap", "deception", "death-tunnel"] as const) {
      const planner = plannerFor(theme);
      const plans = Array.from({ length: 4 }, () => planner.planNext(50, 0, difficulty));
      expect(plans.some(plan => members(plan).some(member => member.strength > 75))).toBe(true);
      expect(plans.every(plan => plan.passage !== undefined)).toBe(true);
    }
  });

  it("switches pending layouts before allocation and consumes a requested theme once", () => {
    const planner = plannerFor("death-tunnel");
    expect(planner.getNextRowPlatformCount()).toBe(4);
    planner.queueEncounter("rich-lane");
    expect(planner.getNextRowPlatformCount()).toBe(2);
    for (let i = 0; i < 5; i++) expect(planner.planNext(20, 0, difficulty).encounterTheme).toBe("rich-lane");
    expect(planner.planNext(20, 0, difficulty).section).toBe("run-up");
    planner.queueEncounter("trap");
    expect(planner.planNext(20, 0, difficulty).encounterRowIndex).toBe(0);
  });
});


it("breaks permanent straight bypasses, including the seams of wide-screen cells", () => {
  for (const theme of ["trap", "death-tunnel", "danger-lane"] as const) {
    const planner = plannerFor(theme);
    const plans = Array.from({ length: 18 }, () => planner.planNext(30, 0, difficulty));
    for (let x = -4.5; x <= 4.5; x += .25) {
      expect(plans.some(plan => members(plan).some(member => Math.abs(member.x - x) <= member.widthScale * 7.5 / 2 + .5))).toBe(true);
    }
    expect(plans.some(plan => members(plan).some(member => Math.abs(member.x - 5) <= member.widthScale * 7.5 / 2 + .5))).toBe(true);
    expect(plans.some(plan => members(plan).some(member => Math.abs(member.x + 5) <= member.widthScale * 7.5 / 2 + .5))).toBe(true);
  }
});


it.each(themes)("mixes broad joined ledges and short islands regularly in %s", theme => {
  for (let variant = 0; variant < 4; variant++) {
    const planner = plannerFor(theme, variant);
    const plans = Array.from({ length: 12 }, () => planner.planNext(30, 0, difficulty));
    const widths = plans.flatMap(plan => members(plan).map(member => member.widthScale * 7.5));
    expect(widths.filter(width => width >= 3.5).length).toBeGreaterThanOrEqual(2);
    expect(widths.some(width => platformSpriteSlices(width + .6, platformSpriteRect(0, 0)).length >= 5)).toBe(true);
    expect(widths.filter(width => width < 2).length).toBeGreaterThanOrEqual(6);
    expect(plans.slice(0, 6).some(plan => members(plan).some(member => member.widthScale * 7.5 >= 3.5))).toBe(true);
  }
});
