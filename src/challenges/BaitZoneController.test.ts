import { expect, it, vi } from "vitest";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { CoinController, CoinChain } from "../coin/CoinController";
import type { PlatformActivationProperties, PlatformController } from "../platform/PlatformController";
import { gameConfig } from "../config/gameConfig";
import { BaitZoneController } from "./BaitZoneController";

function fixture(random = 0) {
  const ball = { position: { x: 2, y: 0 }, fallSpeed: 50 };
  const coins = Array.from({ length: 36 }, () => {
    const coin = { isActive: false, chain: null as CoinChain | null, mesh: { position: new Vector3() },
      reactivate(position: { x: number; y: number }) { this.isActive = true; this.mesh.position.set(position.x, position.y, 0); },
      collect() { if (this.isActive) { this.isActive = false; if (this.chain) this.chain.remaining--; } },
    };
    return coin;
  });
  const marker = { isActive: true, encounterTheme: "chaos", mesh: { position: new Vector3(0, -1, 0) } };
  const acquire = vi.fn<(position?: Vector3, properties?: PlatformActivationProperties) => PlatformController | null>(() => ({} as PlatformController));
  const pool = { platforms: [marker] as unknown as PlatformController[], availableCount: 1, acquire };
  const finished = vi.fn();
  const zone = new BaitZoneController(ball, coins as unknown as CoinController[], pool, gameConfig,
    () => ({ halfWidth: 5, spaceBelow: 12 }), finished, () => random);
  const approach = () => {
    const active = coins.filter(coin => coin.isActive);
    const newest = active.at(-1);
    if (!newest) throw new Error("Expected a coin wave.");
    ball.position.x = newest.mesh.position.x;
    ball.position.y = Math.max(...active.filter(coin => coin.chain === newest.chain).map(coin => coin.mesh.position.y)) + .5;
    zone.fixedUpdate(.5);
  };
  return { ball, coins, marker, acquire, pool, finished, zone, approach };
}

it("waits for the actual bait zone, alternates opposite the current player, and traps only the last wave", () => {
  const f = fixture();
  f.zone.arm(); f.zone.fixedUpdate(.1);
  expect(f.zone.waveCount).toBe(0);
  f.marker.encounterTheme = "bait"; f.zone.fixedUpdate(.1);
  expect(f.zone.waveCount).toBe(1);
  expect(f.coins.filter(coin => coin.isActive)).toHaveLength(12);
  expect(f.coins.filter(coin => coin.isActive).every(coin => coin.mesh.position.x < 0)).toBe(true);
  expect(f.acquire).not.toHaveBeenCalled();
  f.approach();
  expect(f.zone.waveCount).toBe(2);
  expect(f.coins.slice(12, 24).every(coin => coin.mesh.position.x > 0)).toBe(true);
  expect(f.acquire).not.toHaveBeenCalled();
  f.ball.fallSpeed = 80;
  f.approach();
  expect(f.zone.waveCount).toBe(3);
  expect(f.acquire).toHaveBeenCalledOnce();
  const [position, properties] = f.acquire.mock.calls[0] ?? [];
  expect(properties).toMatchObject({ strength: 160, encounterTheme: "bait", kind: "super-heavy" });
  expect(position?.y).toBeLessThan(Math.min(...f.coins.slice(24).map(coin => coin.mesh.position.y)));
  expect(position?.x).toBeLessThan(0);
  f.ball.fallSpeed = 200;
  for (let i = 0; i < 10; i++) f.zone.fixedUpdate(.1);
  expect(f.acquire).toHaveBeenCalledOnce();
  expect(properties?.strength).toBe(160);
});

it("ignores small movements and remote coin collection; ignoring the lure is an escape", () => {
  const f = fixture(); f.marker.encounterTheme = "bait"; f.zone.arm(); f.zone.fixedUpdate(.1);
  for (let i = 0; i < 20; i++) { f.ball.position.x = 1 + i % 2 * .1; f.zone.fixedUpdate(.1); }
  f.coins.forEach(coin => { coin.collect(); }); f.zone.fixedUpdate(.5);
  expect(f.zone.waveCount).toBe(1);
  f.ball.position.y = -30; f.zone.fixedUpdate(.1); f.zone.fixedUpdate(.1);
  expect(f.finished).toHaveBeenCalledOnce();
  expect(f.acquire).not.toHaveBeenCalled();
  expect(f.zone.active).toBe(false);
});

it("varies the finite length and waits for pool capacity before exposing the final reward", () => {
  const f = fixture(); f.marker.encounterTheme = "bait"; f.zone.arm(); f.zone.fixedUpdate(.1); f.approach();
  f.pool.availableCount = 0;
  f.approach();
  expect(f.zone.waveCount).toBe(2);
  expect(f.coins.filter(coin => coin.isActive)).toHaveLength(24);
  f.pool.availableCount = 1; f.zone.fixedUpdate(.1);
  expect(f.zone.waveCount).toBe(3);
  expect(f.acquire).toHaveBeenCalledOnce();
  expect(fixture(.999).zone.waveLimit).toBe(3);
  const long = fixture(.999); long.zone.arm();
  expect(long.zone.waveLimit).toBe(6);
  long.zone.cancel(); long.marker.encounterTheme = "bait"; long.zone.fixedUpdate(1);
  expect(long.zone.waveCount).toBe(0);
  expect(long.coins.some(coin => coin.isActive)).toBe(false);
});
