import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { describe, expect, it, vi } from "vitest";
import type { PlatformController } from "./PlatformController";
import { PlatformPool } from "./PlatformPool";

function createPlatform(): {
  platform: PlatformController;
  reactivate: ReturnType<typeof vi.fn>;
} {
  const platform = {
    isActive: true,
    isBreaking: false,
    beginBreak: vi.fn(() => {
      if (!platform.isActive) {
        return false;
      }
      platform.isActive = false;
      platform.isBreaking = true;
      return true;
    }),
    finishBreak: vi.fn(() => {
      if (!platform.isBreaking) {
        return false;
      }
      platform.isBreaking = false;
      return true;
    }),
    deactivate: vi.fn(() => {
      platform.isActive = false;
      platform.isBreaking = false;
    }),
    reactivate: vi.fn(() => {
      platform.isActive = true;
    }),
    dispose: vi.fn(),
  };
  return {
    platform: platform as unknown as PlatformController,
    reactivate: platform.reactivate,
  };
}

describe("PlatformPool", () => {
  it("reuses a released platform instead of creating another object", () => {
    const { platform, reactivate } = createPlatform();
    const pool = new PlatformPool([platform]);
    const position = new Vector3(2, -10, 0);

    expect(pool.release(platform)).toBe(true);
    expect(pool.release(platform)).toBe(false);
    expect(pool.acquire(position)).toBe(platform);
    expect(reactivate).toHaveBeenCalledWith(position);
    expect(pool.acquire()).toBeNull();
  });

  it("does not make a breaking platform available before its animation completes", () => {
    const { platform } = createPlatform();
    const pool = new PlatformPool([platform]);

    expect(pool.beginRelease(platform)).toBe(true);
    expect(pool.acquire()).toBeNull();
    expect(pool.completeRelease(platform)).toBe(true);
    expect(pool.acquire()).toBe(platform);
  });
});
