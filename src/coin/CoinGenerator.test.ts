import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { describe, expect, it, vi } from "vitest";
import { gameConfig } from "../config/gameConfig";
import type { PlannedPlatform } from "../platform/PlatformRoutePlanner";
import { CoinGenerator } from "./CoinGenerator";
import type { CoinController } from "./CoinController";

function createCoin(active = false): CoinController {
  const coin = {
    isActive: active,
    mesh: { position: new Vector3(0, 0, 0) },
    deactivate: vi.fn(() => {
      coin.isActive = false;
    }),
    reactivate: vi.fn((position: Readonly<{ x: number; y: number }>) => {
      coin.mesh.position.x = position.x;
      coin.mesh.position.y = position.y;
      coin.isActive = true;
      return true;
    }),
  };
  return coin as unknown as CoinController;
}

function plan(overrides: Partial<PlannedPlatform> = {}): PlannedPlatform {
  return {
    x: 0,
    y: -10,
    strength: 12,
    strengthLevel: "medium",
    routeKind: "mandatory",
    widthScale: 1,
    safeLaneX: 0,
    reactionWindowSeconds: 1,
    stageNumber: 1,
    kind: "standard",
    encounterTheme: "chaos",
    encounterRowIndex: 0,
    ...overrides,
  };
}

describe("CoinGenerator", () => {
  it("keeps spawning pooled coins along generated routes", () => {
    const coin = createCoin();
    const generator = new CoinGenerator(
      { position: { x: 0, y: 0, z: 0 } },
      [coin],
      gameConfig,
    );

    generator.handlePlatformGenerated(plan());
    expect(coin.isActive).toBe(false);

    generator.handlePlatformGenerated(
      plan({ routeKind: "bypass", safeLaneX: 3.5, y: -14 }),
    );
    expect(coin.isActive).toBe(true);
    expect(coin.mesh.position.x).toBe(3.5);
    expect(coin.mesh.position.y).toBeCloseTo(
      -14 + gameConfig.coins.heightAbovePlatform,
      10,
    );
  });

  it("recycles coins left above the moving play window", () => {
    const coin = createCoin(true);
    coin.mesh.position.y = 4;
    const generator = new CoinGenerator(
      { position: { x: 0, y: -10, z: 0 } },
      [coin],
      gameConfig,
    );

    generator.fixedUpdate();

    expect(coin.isActive).toBe(false);
  });

  it("spawns exactly ten coins in one vertical rich-lane trail", () => {
    const coins = Array.from({ length: 12 }, () => createCoin());
    const generator = new CoinGenerator(
      { position: { x: 0, y: 0, z: 0 } },
      coins,
      gameConfig,
    );

    generator.handlePlatformGenerated(
      plan({
        x: 2,
        y: -10,
        encounterTheme: "rich-lane",
        coinTrail: {
          x: 2,
          count: 10,
          spacing: gameConfig.coins.richTrailSpacing,
        },
      }),
    );

    const active = coins.filter((coin) => coin.isActive);
    expect(active).toHaveLength(10);
    expect(active.every((coin) => coin.mesh.position.x === 2)).toBe(true);
    expect(active[0]?.mesh.position.y).toBeCloseTo(
      -10 + gameConfig.coins.heightAbovePlatform,
      10,
    );
    expect(active[9]?.mesh.position.y).toBeCloseTo(
      -10 + gameConfig.coins.heightAbovePlatform -
        9 * gameConfig.coins.richTrailSpacing,
      10,
    );
  });
});
