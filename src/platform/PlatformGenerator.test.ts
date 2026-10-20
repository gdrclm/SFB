import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { describe, expect, it, vi } from "vitest";
import { gameConfig } from "../config/gameConfig";
import type { PlatformKind } from "../config/gameConfig";
import type {
  PlatformActivationProperties,
  PlatformController,
  PlatformRouteKind,
} from "./PlatformController";
import { PlatformGenerator } from "./PlatformGenerator";
import type { PlatformPool } from "./PlatformPool";

const difficultySource = {
  currentDifficulty: {
    stageNumber: 1,
    platformStrength: 9,
    reactionWindowSeconds: 1.5,
  },
};

function scriptedRandom(values: readonly number[], fallback = 0): () => number {
  let index = 0;
  return () => values[index++] ?? fallback;
}

interface MockPlatform {
  readonly mesh: { readonly position: Vector3 };
  isActive: boolean;
  routeKind: PlatformRouteKind;
  strength: number;
  kind: PlatformKind;
  widthScale: number;
}

function asController(platform: MockPlatform): PlatformController {
  return platform as unknown as PlatformController;
}

function createPlatform(y: number, isActive: boolean): MockPlatform {
  return {
    mesh: { position: new Vector3(0, y, gameConfig.playSpace.depth) },
    isActive,
    routeKind: "mandatory",
    strength: 7,
    kind: "standard",
    widthScale: 1,
  };
}

function createPool(platforms: MockPlatform[]): {
  pool: PlatformPool;
  acquire: ReturnType<typeof vi.fn>;
  release: ReturnType<typeof vi.fn>;
} {
  const acquire = vi.fn(
    (position?: Vector3, properties?: PlatformActivationProperties) => {
      const platform = platforms.find((candidate) => !candidate.isActive);
      if (platform === undefined || position === undefined || properties === undefined) {
        return null;
      }
      platform.mesh.position.copyFrom(position);
      platform.isActive = true;
      platform.routeKind = properties.routeKind ?? "mandatory";
      platform.strength = properties.strength;
      platform.kind = properties.kind ?? "standard";
      platform.widthScale = properties.widthScale ?? 1;
      return asController(platform);
    },
  );
  const release = vi.fn((platform: PlatformController) => {
    const mock = platform as unknown as MockPlatform;
    if (!mock.isActive) {
      return false;
    }
    mock.isActive = false;
    return true;
  });
  return {
    pool: {
      platforms: platforms.map(asController),
      get availableCount() {
        return platforms.filter((platform) => !platform.isActive).length;
      },
      acquire,
      release,
    } as unknown as PlatformPool,
    acquire,
    release,
  };
}

describe("PlatformGenerator", () => {
  it("does not generate random rows while staging and restarts at the ball after training", () => {
    const platforms = Array.from({ length: 36 }, () => createPlatform(0, false));
    const { pool, acquire } = createPool(platforms);
    const ball = { position: { x: 0, y: 4.5, z: 0 }, fallSpeed: 10 };
    const generator = new PlatformGenerator(ball, pool, difficultySource, gameConfig, () => 0);
    generator.enabled = false;
    generator.fixedUpdate();
    expect(acquire).not.toHaveBeenCalled();
    ball.position.y = -500;
    generator.resumeFromCurrentPosition();
    generator.fixedUpdate();
    expect(acquire).toHaveBeenCalled();
    const active = platforms.filter((platform) => platform.isActive);
    expect(active.length).toBeGreaterThan(0);
    expect(active.every((platform) => platform.mesh.position.y < -500)).toBe(true);
  });

  it("keeps a continuous look-ahead window using pooled platforms", () => {
    const platforms = [
      createPlatform(1, true),
      createPlatform(-2, true),
      createPlatform(-5, true),
      ...Array.from({ length: 17 }, () => createPlatform(0, false)),
    ];
    const { pool, acquire } = createPool(platforms);
    const ball = {
      fallSpeed: 10,
      position: { x: 0, y: 4.5, z: gameConfig.playSpace.depth },
    };
    const generator = new PlatformGenerator(
      ball,
      pool,
      difficultySource,
      gameConfig,
      scriptedRandom([0.72, 0]),
    );

    generator.fixedUpdate();

    const ahead = platforms.filter(
      (platform) => platform.isActive && platform.mesh.position.y < ball.position.y,
    );
    const aheadRows = new Set(
      ahead.map((platform) => platform.mesh.position.y.toFixed(4)),
    );
    expect(aheadRows.size).toBe(gameConfig.platformGeneration.lookAheadCount);
    expect(ahead).toHaveLength(15);
    expect(acquire).toHaveBeenCalledTimes(12);
    expect(Math.min(...ahead.map((platform) => platform.mesh.position.y))).toBeLessThan(-5);
  });

  it("recycles platforms left far above the moving play window", () => {
    const oldPlatform = createPlatform(1, true);
    const platforms = [
      oldPlatform,
      createPlatform(-22, true),
      ...Array.from({ length: 10 }, () => createPlatform(0, false)),
    ];
    const { pool, release } = createPool(platforms);
    const generator = new PlatformGenerator(
      {
        fallSpeed: 10,
        position: { x: 0, y: -10, z: gameConfig.playSpace.depth },
      },
      pool,
      difficultySource,
      gameConfig,
      scriptedRandom([0.55, 0]),
    );

    generator.fixedUpdate();

    expect(release).toHaveBeenCalledWith(asController(oldPlatform));
  });

  it("does not advance the route while the pool has no free platform", () => {
    const first = createPlatform(-5, true);
    const waiting = createPlatform(-4, true);
    const secondWaiting = createPlatform(-3, true);
    const platforms = [first, waiting, secondWaiting];
    const { pool, acquire } = createPool(platforms);
    const generator = new PlatformGenerator(
      {
        fallSpeed: 10,
        position: { x: 0, y: 4.5, z: gameConfig.playSpace.depth },
      },
      pool,
      difficultySource,
      gameConfig,
      scriptedRandom([0.55, 0]),
    );

    generator.fixedUpdate();
    expect(acquire).not.toHaveBeenCalled();

    waiting.isActive = false;
    secondWaiting.isActive = false;
    generator.fixedUpdate();

    expect(acquire).toHaveBeenCalledTimes(2);
    expect(waiting.mesh.position.y).toBeCloseTo(-10, 10);
    expect(secondWaiting.mesh.position.y).toBeCloseTo(-10, 10);
    expect([waiting.strength, secondWaiting.strength]).toContain(9);
  });

  it("materializes consecutive rich-lane and death-tunnel zones", () => {
    const platforms = Array.from({ length: 20 }, () => createPlatform(0, false));
    const { pool } = createPool(platforms);
    const generator = new PlatformGenerator(
      {
        fallSpeed: 20,
        position: { x: 0, y: 4.5, z: gameConfig.playSpace.depth },
      },
      pool,
      {
        currentDifficulty: {
          stageNumber: 6,
          platformStrength: 18,
          reactionWindowSeconds: 0.85,
        },
      },
      gameConfig,
      scriptedRandom([0.55, 0, 0.99, 0]),
    );

    generator.fixedUpdate();

    const active = platforms.filter((platform) => platform.isActive);
    const groupedByY = new Map<string, MockPlatform[]>();
    for (const platform of active) {
      const key = platform.mesh.position.y.toFixed(4);
      groupedByY.set(key, [...(groupedByY.get(key) ?? []), platform]);
    }
    const rows = [...groupedByY.values()];
    const fourChoiceRow = rows.find((row) => row.length === 4);

    expect(groupedByY.size).toBe(gameConfig.platformGeneration.lookAheadCount);
    expect(rows.map((row) => row.length)).toEqual([2, 2, 2, 2, 2, 4]);
    expect(fourChoiceRow?.filter((platform) => platform.kind === "super-heavy"))
      .toHaveLength(2);
    const template = gameConfig.platforms[0];
    if (template === undefined) {
      throw new Error("A platform template is required.");
    }
    for (const row of rows) {
      for (const platform of row) {
        const halfWidth =
          template.size.width * platform.widthScale / 2;
        expect(Math.abs(platform.mesh.position.x) + halfWidth).toBeLessThanOrEqual(
          gameConfig.playSpace.halfWidth,
        );
      }
    }
  });
});

it("suppresses forced-slow platforms until BOOST is learned, then permits them", () => {
  const platforms = Array.from({ length: 36 }, () => createPlatform(0, false));
  const { pool } = createPool(platforms);
  const generator = new PlatformGenerator({ fallSpeed: 10, position: { x: 0, y: 4.5, z: 0 } }, pool, difficultySource, gameConfig, () => .99);
  generator.allowSlowPlatforms = false;
  generator.queueEncounter("death-tunnel");
  generator.fixedUpdate();
  expect(platforms.some((p) => p.isActive)).toBe(true);
  expect(platforms.filter((p) => p.isActive).every((p) => p.kind !== "time-slow")).toBe(true);
  for (const platform of platforms) platform.isActive = false;
  generator.allowSlowPlatforms = true;
  generator.queueEncounter("death-tunnel");
  generator.fixedUpdate();
  expect(platforms.some((p) => p.isActive && p.kind === "time-slow")).toBe(true);
});
