import { describe, expect, it, vi } from "vitest";
import type { PlatformController } from "../platform/PlatformController";
import {
  assessPlatformHit,
  CollisionResolver,
  type CollisionBallState,
  type PlatformSweep,
} from "./CollisionResolver";

function createPlatform(strength: number): PlatformController {
  return {
    id: "test-platform",
    strength,
    activationId: 1,
    isActive: true,
  } as PlatformController;
}

describe("assessPlatformHit", () => {
  it("accepts speed equal to platform strength", () => {
    expect(assessPlatformHit(8, 8)).toBe("sufficient");
  });

  it("rejects speed below platform strength", () => {
    expect(assessPlatformHit(7.99, 8)).toBe("insufficient");
  });
});

describe("CollisionResolver", () => {
  it("sweeps the complete movement segment and reports a high-speed crossing", () => {
    const platform = createPlatform(9);
    const ball: CollisionBallState = {
      fallSpeed: 30,
      previousPosition: { x: 1, y: 12, z: 0 },
      position: { x: -2, y: -12, z: 0 },
    };
    const cast = vi.fn(() => platform);
    const sweep: PlatformSweep = { cast, dispose: vi.fn() };
    const resolver = new CollisionResolver(ball, sweep);
    const listener = vi.fn();
    resolver.onCollision(listener);

    resolver.fixedUpdate();

    expect(cast).toHaveBeenCalledWith(ball.previousPosition, ball.position);
    expect(listener).toHaveBeenCalledWith({
      platform,
      ballSpeed: 30,
      assessment: "sufficient",
    });
  });

  it("reports the same static platform only once while the ball crosses it", () => {
    const platform = createPlatform(9);
    const ball: CollisionBallState = {
      fallSpeed: 4,
      previousPosition: { x: 0, y: 1, z: 0 },
      position: { x: 0, y: -1, z: 0 },
    };
    const sweep: PlatformSweep = { cast: () => platform, dispose: vi.fn() };
    const resolver = new CollisionResolver(ball, sweep);
    const listener = vi.fn();
    resolver.onCollision(listener);

    resolver.fixedUpdate();
    resolver.fixedUpdate();

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({
      platform,
      ballSpeed: 4,
      assessment: "insufficient",
    });
  });

  it("reports a pooled platform again after its reactivation", () => {
    const platform = createPlatform(7);
    const ball: CollisionBallState = {
      fallSpeed: 8,
      previousPosition: { x: 0, y: 2, z: 0 },
      position: { x: 0, y: 0, z: 0 },
    };
    const sweep: PlatformSweep = { cast: () => platform, dispose: vi.fn() };
    const resolver = new CollisionResolver(ball, sweep);
    const listener = vi.fn();
    resolver.onCollision(listener);

    resolver.fixedUpdate();
    (platform as unknown as { activationId: number }).activationId = 2;
    resolver.fixedUpdate();

    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("reports a surviving platform again after the ball separates from it", () => {
    const platform = createPlatform(9);
    const ball: CollisionBallState = {
      fallSpeed: 8,
      previousPosition: { x: 0, y: 1, z: 0 },
      position: { x: 0, y: -1, z: 0 },
    };
    const cast = vi.fn()
      .mockReturnValueOnce(platform)
      .mockReturnValueOnce(null)
      .mockReturnValueOnce(platform);
    const sweep: PlatformSweep = { cast, dispose: vi.fn() };
    const resolver = new CollisionResolver(ball, sweep);
    const listener = vi.fn();
    resolver.onCollision(listener);

    resolver.fixedUpdate();
    resolver.fixedUpdate();
    resolver.fixedUpdate();

    expect(listener).toHaveBeenCalledTimes(2);
  });
});
