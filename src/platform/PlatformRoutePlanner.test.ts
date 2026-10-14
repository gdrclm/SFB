import { describe, expect, it } from "vitest";
import { gameConfig } from "../config/gameConfig";
import type { PhaseOneDifficulty } from "../progression/PhaseOneController";
import {
  PlatformRoutePlanner,
  type PlannedPlatform,
  type PlannedPlatformChoice,
  type PlatformEncounterTheme,
} from "./PlatformRoutePlanner";

const THEME_RANDOM: Readonly<Record<PlatformEncounterTheme, number>> = {
  chaos: 0.01,
  trap: 0.2,
  deception: 0.4,
  "rich-lane": 0.55,
  "danger-lane": 0.72,
  "death-tunnel": 0.9,
};

function difficulty(
  platformStrength: number,
  reactionWindowSeconds = 1.5,
  stageNumber = 1,
): PhaseOneDifficulty {
  return { stageNumber, platformStrength, reactionWindowSeconds };
}

function scriptedRandom(values: readonly number[], fallback = 0): () => number {
  let index = 0;
  return () => values[index++] ?? fallback;
}

function plannerFor(
  theme: PlatformEncounterTheme,
  variant = 0,
): PlatformRoutePlanner {
  return new PlatformRoutePlanner(
    0,
    gameConfig,
    scriptedRandom([THEME_RANDOM[theme], variant / 4]),
  );
}

function rowMembers(
  plan: PlannedPlatform,
): readonly (PlannedPlatformChoice & { readonly isPrimary?: boolean })[] {
  return [
    {
      x: plan.x,
      strength: plan.strength,
      strengthLevel: plan.strengthLevel,
      routeKind: plan.routeKind,
      widthScale: plan.widthScale,
      kind: plan.kind,
      isTrap: plan.routeKind !== "mandatory",
      isPrimary: true,
    },
    ...(plan.choices ?? []),
  ];
}

describe("PlatformRoutePlanner encounters", () => {
  it("preserves the configured reaction window at different speeds", () => {
    const slowPlanner = plannerFor("trap");
    const fastPlanner = plannerFor("trap");

    const slowPlan = slowPlanner.planNext(10, 0, difficulty(9));
    const fastPlan = fastPlanner.planNext(20, 0, difficulty(9));

    expect(slowPlan.reactionWindowSeconds).toBeCloseTo(1.5, 10);
    expect(fastPlan.reactionWindowSeconds).toBeCloseTo(1.5, 10);
    expect(Math.abs(fastPlan.y)).toBeCloseTo(Math.abs(slowPlan.y) * 2, 10);
  });

  it("keeps a selected theme for a full zone and never repeats it immediately", () => {
    const planner = new PlatformRoutePlanner(
      0,
      gameConfig,
      scriptedRandom([THEME_RANDOM["rich-lane"], 0, 0.99, 0]),
    );
    const plans = Array.from({ length: 6 }, () =>
      planner.planNext(20, 0, difficulty(10)),
    );

    expect(plans.slice(0, 5).map((plan) => plan.encounterTheme)).toEqual(
      Array.from({ length: 5 }, () => "rich-lane"),
    );
    expect(plans[5]?.encounterTheme).toBe("death-tunnel");
  });

  it("builds a trap by placing a deadly platform behind vitality", () => {
    const planner = plannerFor("trap");
    const bait = planner.planNext(20, 0, difficulty(10));
    const followUp = planner.planNext(20, 0, difficulty(10));
    const deathBehindBait = rowMembers(followUp).find(
      (member) => member.kind === "super-heavy" && member.x === bait.x,
    );

    expect(bait.kind).toBe("vitality");
    expect(deathBehindBait).toBeDefined();
    expect(followUp.x).not.toBe(bait.x);
  });

  it("turns two attractive deception lanes into deadly lanes on the next row", () => {
    const planner = plannerFor("deception");
    const bait = planner.planNext(20, 0, difficulty(10));
    const followUp = planner.planNext(20, 0, difficulty(10));
    const attractiveLaneXs = rowMembers(bait)
      .filter((member) => member.kind === "vitality" || member.kind === "time-slow")
      .map((member) => member.x);
    const deadlyXs = rowMembers(followUp)
      .filter((member) => member.kind === "super-heavy")
      .map((member) => member.x);

    expect(attractiveLaneXs).toHaveLength(2);
    expect(deadlyXs.sort((left, right) => left - right)).toEqual(
      attractiveLaneXs.sort((left, right) => left - right),
    );
    expect(followUp.routeKind).toBe("boost");
  });

  it("marks a rich lane with one vertical trail of exactly ten coins", () => {
    const planner = plannerFor("rich-lane");
    const plan = planner.planNext(20, 0, difficulty(10));

    expect(plan.coinTrail).toEqual({
      x: plan.x,
      count: 10,
      spacing: gameConfig.coins.richTrailSpacing,
    });
    expect(plan.encounterTheme).toBe("rich-lane");
  });

  it("creates a danger lane with three deadly choices", () => {
    const planner = plannerFor("danger-lane");
    const plan = planner.planNext(20, 0, difficulty(10));
    const members = rowMembers(plan);

    expect(members).toHaveLength(4);
    expect(members.filter((member) => member.kind === "super-heavy")).toHaveLength(3);
    expect(plan.strength).toBeLessThanOrEqual(20);
  });

  it("creates a five-row tunnel with deadly outer walls", () => {
    const planner = plannerFor("death-tunnel");
    const plans = Array.from({ length: 5 }, () =>
      planner.planNext(20, 0, difficulty(10)),
    );

    for (const plan of plans) {
      const members = [...rowMembers(plan)].sort((left, right) => left.x - right.x);
      expect(members[0]?.kind).toBe("super-heavy");
      expect(members.at(-1)?.kind).toBe("super-heavy");
      expect(Math.abs(plan.x)).toBeLessThan(
        gameConfig.platformGeneration.choiceLaneOffsetX,
      );
    }
  });

  it("keeps encounter rows inside the play space without bypass-sized gaps", () => {
    const template = gameConfig.platforms[0];
    if (template === undefined) {
      throw new Error("A platform template is required.");
    }

    for (const theme of Object.keys(THEME_RANDOM) as PlatformEncounterTheme[]) {
      const planner = plannerFor(theme);
      const members = [...rowMembers(
        planner.planNext(20, 0, difficulty(10)),
      )].sort((left, right) => left.x - right.x);
      const width = template.size.width * (members[0]?.widthScale ?? 0);
      expect((members[0]?.x ?? 0) - width / 2).toBeGreaterThanOrEqual(
        -gameConfig.playSpace.halfWidth,
      );
      expect((members.at(-1)?.x ?? 0) + width / 2).toBeLessThanOrEqual(
        gameConfig.playSpace.halfWidth,
      );
      for (let index = 1; index < members.length; index += 1) {
        const gap =
          (members[index]?.x ?? 0) -
          (members[index - 1]?.x ?? 0) -
          width;
        expect(gap).toBeLessThan(gameConfig.ball.radius * 2);
      }
    }
  });

  it("keeps boost routes within one Boost and black routes above one Boost", () => {
    const planner = plannerFor("danger-lane");
    const first = planner.planNext(20, 0, difficulty(12));
    const second = planner.planNext(20, 0, difficulty(12));
    const members = [...rowMembers(first), ...rowMembers(second)];
    const boost = members.find((member) => member.routeKind === "boost");
    const deadly = members.find((member) => member.kind === "super-heavy");

    expect(boost?.strength).toBeGreaterThan(20);
    expect(boost?.strength).toBeLessThanOrEqual(
      20 + gameConfig.boost.speedIncrease,
    );
    expect(deadly?.strength).toBeGreaterThan(
      20 + gameConfig.boost.speedIncrease,
    );
  });
});
