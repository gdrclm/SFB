import { WorldStep } from "../core/WorldStep";
import { CoinCollectionController } from "../coin/CoinCollectionController";
import { CoinController } from "../coin/CoinController";
import { RunWallet } from "../currency/RunWallet";
import { GameState, GameStateController } from "../core/GameStateController";
import { LifeCounter } from "../run/LifeCounter";
import { UnsuccessfulPlatformHitHandler } from "./UnsuccessfulPlatformHitHandler";
import HavokPhysics from "@babylonjs/havok";
import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { HavokPlugin } from "@babylonjs/core/Physics";
import { gameConfig } from "../config/gameConfig";
import { PlatformController } from "../platform/PlatformController";
import { PlatformPool } from "../platform/PlatformPool";
import { PlatformGenerator } from "../platform/PlatformGenerator";
import { BallController } from "../ball/BallController";
import { CollisionResolver } from "./CollisionResolver";
import { HavokPlatformSweep } from "./HavokPlatformSweep";
import { SuccessfulPlatformHitHandler } from "./SuccessfulPlatformHitHandler";
async function world(strength = 7) {
  const engine = new NullEngine(), scene = new Scene(engine);
  const wasm = await readFile(new URL("../../node_modules/@babylonjs/havok/lib/esm/HavokPhysics.wasm", import.meta.url));
  const plugin = new HavokPlugin(true, await HavokPhysics({ wasmBinary: Uint8Array.from(wasm).buffer }));
  scene.enablePhysics(Vector3.Zero(), plugin);
  const platforms = [1, -2, -5].map((y, i) => {
    const template = gameConfig.platforms[0]; if (!template) throw Error("Missing template");
    return new PlatformController(scene, gameConfig, { ...template, id: `crossed-${String(i)}`, position: { x: 0, y }, strength });
  });
  const pool = new PlatformPool(platforms);
  const sweep = new HavokPlatformSweep(scene, plugin, gameConfig.ball.radius, platforms);
  const feedback = { playPlatformBreak: (_p: PlatformController, done: () => void) => { done(); }, playBallReaction: () => {}, playCameraReaction: () => {} };
  return { scene, platforms, pool, sweep, feedback, dispose: () => { sweep.dispose(); platforms.forEach(p => { p.dispose(); }); scene.dispose(); engine.dispose(); } };
}
it("processes every platform crossed by an invulnerable ball in a single real Havok sweep", async () => {
  const w = await world();
  try {
    const ball = { fallSpeed: 6000, previousPosition: { x: 0, y: 5, z: 0 }, position: { x: 0, y: -20, z: 0 } };
    const handler = new SuccessfulPlatformHitHandler(ball, w.pool, w.feedback, gameConfig);
    const resolver = new CollisionResolver(ball, w.sweep);
    const hits: string[] = [];
    resolver.onCollision(c => { hits.push(c.platform.id); handler.handle(c, true); });
    resolver.fixedUpdate();
    expect(hits).toEqual(["crossed-0", "crossed-1", "crossed-2"]);
    expect(w.platforms.every(p => !p.isActive)).toBe(true);
  } finally { w.dispose(); }
});
it("keeps crossed platforms until collision resolution even if cleanup is called after a 25m step", async () => {
  const w = await world();
  try {
    const ball = { fallSpeed: 6000, previousPosition: { x: 0, y: 5, z: 0 }, position: { x: 0, y: -20, z: 0 } };
    const generator = new PlatformGenerator(ball, w.pool, { currentDifficulty: { stageNumber: 1, platformStrength: 7, reactionWindowSeconds: 1 } }, gameConfig);
    generator.fixedUpdate();
    expect(w.sweep.cast(ball.previousPosition, ball.position)?.id).toBe("crossed-0");
  } finally { w.dispose(); }
});
it("ordinary impact stops at the first surface and preserves the actual traversed segment", async () => {
  const w = await world();
  try {
    const ball = new BallController({ position: { x: 0, y: 0, z: 0 } }, { normalizedPosition: 1, isActive: true, isImmediate: true }, gameConfig);
    const handler = new SuccessfulPlatformHitHandler(ball, w.pool, w.feedback, gameConfig);
    const resolver = new CollisionResolver(ball, w.sweep);
    resolver.onCollision(c => handler.handle(c));
    ball.fallSpeed = 6000; ball.fixedUpdate(1 / 60);
    resolver.fixedUpdate();
    expect(w.platforms[0]?.isActive).toBe(false);
    expect(w.platforms[1]?.isActive).toBe(true);
    expect(ball.position.y).toBeGreaterThan(1);
    expect(ball.position.x).toBeGreaterThan(0); expect(ball.position.x).toBeLessThan(16 / 60);
    expect(ball.previousPosition.y).toBe(gameConfig.ball.startPosition.y);
  } finally { w.dispose(); }
});

it("resolves the impact before coin speed rewards and only collects coins on the actual path up to contact", async () => {
  const w = await world(601);
  const above = new CoinController(w.scene, gameConfig, { x: 0, y: 3 }, 0);
  const behind = new CoinController(w.scene, gameConfig, { x: 0, y: .7 }, 1);
  const wallet = new RunWallet(30, 2), lives = new LifeCounter(3), state = new GameStateController();
  state.transitionTo(GameState.Playing);
  const ball = new BallController({ position: { x: 0, y: 0, z: 0 } }, { normalizedPosition: 0, isActive: false }, gameConfig);
  ball.fallSpeed = 600;
  const resolver = new CollisionResolver(ball, w.sweep);
  const failed = new UnsuccessfulPlatformHitHandler(ball, state, lives, { playErrorReaction: () => {} }, gameConfig);
  let assessment = "";
  resolver.onCollision(c => { assessment = c.assessment; failed.handle(c); });
  const coins = new CoinCollectionController(ball, [above, behind], wallet, gameConfig);
  const noop = { fixedUpdate: () => {} };
  try {
    new WorldStep(ball, resolver, coins, noop, noop).fixedUpdate(1 / 60);
    expect(assessment).toBe("insufficient"); expect(lives.remainingLives).toBe(2);
    expect(above.isActive).toBe(false); expect(behind.isActive).toBe(true); expect(wallet.coins).toBe(1);
    expect(ball.position.y).toBeGreaterThan(1.5); expect(ball.previousPosition.y).toBe(4.5);
    ball.fixedUpdate(gameConfig.unsuccessfulHit.bounceDurationSeconds);
    expect(ball.fallSpeed).toBe(gameConfig.ball.startFallSpeed + gameConfig.economy.speedPerCoin);
  } finally { coins.dispose(); w.dispose(); }
});
