import { describe, expect, it, vi } from "vitest";
import { gameConfig } from "../config/gameConfig";
import type { PlatformController } from "../platform/PlatformController";
import type { PlatformCollision } from "./CollisionResolver";
import {
  SuccessfulPlatformHitHandler,
  type SuccessfulHitFeedback,
} from "./SuccessfulPlatformHitHandler";

function createFeedback(): {
  feedback: SuccessfulHitFeedback;
  playPlatformBreak: ReturnType<typeof vi.fn>;
  playBallReaction: ReturnType<typeof vi.fn>;
  playCameraReaction: ReturnType<typeof vi.fn>;
} {
  const playPlatformBreak = vi.fn(
    (_platform: PlatformController, onComplete: () => void) => {
      onComplete();
    },
  );
  const playBallReaction = vi.fn();
  const playCameraReaction = vi.fn();
  return {
    feedback: { playPlatformBreak, playBallReaction, playCameraReaction },
    playPlatformBreak,
    playBallReaction,
    playCameraReaction,
  };
}

describe("SuccessfulPlatformHitHandler", () => {
  it("releases the platform and subtracts exactly one unit of speed", () => {
    const ball = { fallSpeed: 10 };
    const platform = { isActive: true, strength: 7 } as PlatformController;
    const beginRelease = vi.fn(() => true);
    const completeRelease = vi.fn(() => true);
    const pool = { beginRelease, completeRelease };
    const feedback = createFeedback();
    const handler = new SuccessfulPlatformHitHandler(ball, pool, feedback.feedback, gameConfig);
    const collision: PlatformCollision = {
      platform,
      ballSpeed: 10,
      assessment: "sufficient",
    };

    expect(handler.handle(collision)).toBe(true);

    expect(ball.fallSpeed).toBe(9);
    expect(beginRelease).toHaveBeenCalledWith(platform);
    expect(completeRelease).toHaveBeenCalledWith(platform);
    expect(feedback.playPlatformBreak).toHaveBeenCalledWith(platform, expect.any(Function), 10 / 7);
    expect(feedback.playBallReaction).toHaveBeenCalledOnce();
    expect(feedback.playCameraReaction).toHaveBeenCalledWith(10 / 7);
  });

  it("does nothing when the ball speed is insufficient", () => {
    const ball = { fallSpeed: 6 };
    const platform = { isActive: true, strength: 7 } as PlatformController;
    const beginRelease = vi.fn(() => true);
    const completeRelease = vi.fn(() => true);
    const pool = { beginRelease, completeRelease };
    const feedback = createFeedback();
    const handler = new SuccessfulPlatformHitHandler(ball, pool, feedback.feedback, gameConfig);

    expect(
      handler.handle({
        platform,
        ballSpeed: 6,
        assessment: "insufficient",
      }),
    ).toBe(false);

    expect(ball.fallSpeed).toBe(6);
    expect(beginRelease).not.toHaveBeenCalled();
    expect(completeRelease).not.toHaveBeenCalled();
    expect(feedback.playPlatformBreak).not.toHaveBeenCalled();
    expect(feedback.playBallReaction).not.toHaveBeenCalled();
    expect(feedback.playCameraReaction).not.toHaveBeenCalled();
  });
});
