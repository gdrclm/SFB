import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { Scene } from "@babylonjs/core/scene";
import { describe, expect, it } from "vitest";
import { gameConfig } from "../config/gameConfig";
import { RunWallet } from "../currency/RunWallet";
import type { PlannedPlatform } from "../platform/PlatformRoutePlanner";
import { CoinController } from "./CoinController";
import { CoinGenerator } from "./CoinGenerator";
import { CoinCollectionController } from "./CoinCollectionController";

function fixture(requested = 3) {
  const engine = new NullEngine(); const scene = new Scene(engine);
  const coins = Array.from({ length: 3 }, (_, i) => new CoinController(scene, gameConfig, { x: 0, y: 0 }, i));
  for (const coin of coins) coin.deactivate();
  const ball = { previousPosition: { x: 0, y: 10, z: 0 }, position: { x: 0, y: 0, z: 0 }, fallSpeed: 10 };
  const generator = new CoinGenerator(ball, coins, gameConfig);
  const plan: PlannedPlatform = { x: 0, y: 5, strength: 7, strengthLevel: "low", routeKind: "mandatory",
    widthScale: 1, safeLaneX: 0, reactionWindowSeconds: 1, stageNumber: 1, kind: "standard",
    encounterTheme: "rich-lane", encounterRowIndex: 0, coinTrail: { x: 0, count: requested, spacing: 0.2 } };
  generator.handlePlatformGenerated(plan);
  const collection = new CoinCollectionController(ball, coins, new RunWallet(30, 2), gameConfig);
  return { engine, scene, coins, collection };
}
describe("rich coin chains", () => {
  it("completes exactly once after every coin from the actual trail is collected", () => {
    const { engine, scene, coins, collection } = fixture();
    let complete = 0;
    collection.onCollected((coin) => { if (coin.chain?.remaining === 0 && !coin.chain.cancelled) complete++; });
    collection.fixedUpdate(1 / 60); collection.fixedUpdate(1 / 60);
    expect(complete).toBe(1); expect(coins[0]?.chain?.remaining).toBe(0);
    scene.dispose(); engine.dispose();
  });
  it("does not celebrate a trail with a missed/recycled coin and clears identity on reuse", () => {
    const { engine, scene, coins, collection } = fixture();
    coins[0]?.deactivate(); let complete = 0;
    collection.onCollected((coin) => { if (coin.chain?.remaining === 0 && !coin.chain.cancelled) complete++; });
    collection.fixedUpdate(1 / 60);
    expect(complete).toBe(0); expect(coins[1]?.chain?.cancelled).toBe(true);
    coins[1]?.reactivate({ x: 1, y: -10 }); expect(coins[1]?.chain).toBeNull();
    scene.dispose(); engine.dispose();
  });
  it("does not award completion when the pool could spawn only part of a requested trail", () => {
    const { engine, scene, coins, collection } = fixture(10);
    collection.fixedUpdate(1 / 60);
    expect(coins[0]?.chain?.remaining).toBe(0);
    expect(coins[0]?.chain?.cancelled).toBe(true);
    scene.dispose(); engine.dispose();
  });
});
