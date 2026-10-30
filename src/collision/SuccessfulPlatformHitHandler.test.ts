import { BoostController } from "../boost/BoostController";
import { GameState } from "../core/GameStateController";
import { RunWallet } from "../currency/RunWallet";
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
  it("releases the platform and spends momentum in proportion to resistance", () => {
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

    expect(ball.fallSpeed).toBeCloseTo(9.902);
    expect(beginRelease).toHaveBeenCalledWith(platform);
    expect(completeRelease).toHaveBeenCalledWith(platform);
    expect(feedback.playPlatformBreak).toHaveBeenCalledWith(platform, expect.any(Function), 10 / 7,10,false);
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

it("plasma breaks an otherwise impossible platform without impact braking or speed loss", () => {
  const ball = { fallSpeed: 180, startBreakImpact: vi.fn() };
  const platform = { isActive: true, strength: 1000 } as PlatformController;
  const pool = { beginRelease: vi.fn(() => true), completeRelease: vi.fn(() => true) };
  const feedback = createFeedback();
  const handler = new SuccessfulPlatformHitHandler(ball, pool, feedback.feedback, gameConfig);
  expect(handler.handle({ platform, ballSpeed: 180, assessment: "insufficient" }, true)).toBe(true);
  expect(pool.completeRelease).toHaveBeenCalledWith(platform);
  expect(ball.fallSpeed).toBe(180); expect(ball.startBreakImpact).not.toHaveBeenCalled();
});
it("keeps earned break power distinct from immunity and refuses an insufficient-speed platform",()=>{
 const ball={fallSpeed:20,breakFlow:1,powerBreakSeconds:3};
 const platform={isActive:true,strength:100} as PlatformController,pool={beginRelease:vi.fn(()=>true),completeRelease:vi.fn(()=>true)};
 const feedback=createFeedback(),handler=new SuccessfulPlatformHitHandler(ball,pool,feedback.feedback,gameConfig);
 expect(handler.handle({platform,ballSpeed:20,assessment:"insufficient"})).toBe(false);
 expect(pool.beginRelease).not.toHaveBeenCalled();expect(ball.fallSpeed).toBe(20);
});


it("barely slows a fast ball on a weak panel, preserves the run even on a near-limit hit", () => {
  const remaining = (strength: number): number => {
    const ball = { fallSpeed: 50, startBreakImpact: vi.fn() };
    const platform = { isActive: true, strength, mesh: { position: { y: 0 } }, size: { height: .3 } } as PlatformController;
    const pool = { beginRelease: () => true, completeRelease: () => true };
    const handler = new SuccessfulPlatformHitHandler(ball, pool, createFeedback().feedback, gameConfig);
    handler.handle({ platform, ballSpeed: 50, assessment: "sufficient" });
    expect(ball.startBreakImpact).toHaveBeenCalledWith(.65, strength / 50, undefined);
    return ball.fallSpeed;
  };
  expect(remaining(10)).toBeCloseTo(49.96);
  expect(remaining(49)).toBeCloseTo(49.4);
  expect(remaining(10)).toBeGreaterThan(remaining(49));
  expect(remaining(49)).toBeGreaterThan(49);
});


it("turns a six-hit risky combo into a net acceleration instead of erasing the run", () => {
  for (const initialSpeed of [10, 50, 180, 600]) {
    const ball = { fallSpeed: initialSpeed };
    const boost = new BoostController(ball, { current: GameState.Playing }, new RunWallet(1000, 2), gameConfig);
    const handler = new SuccessfulPlatformHitHandler(ball,
      { beginRelease: () => true, completeRelease: () => true }, createFeedback().feedback, gameConfig);
    for (let i = 0; i < boost.hitsRequired; i++) {
      const speed = ball.fallSpeed;
      const platform = { isActive: true, strength: speed } as PlatformController;
      expect(handler.handle({ platform, ballSpeed: speed, assessment: "sufficient" })).toBe(true);
      expect(speed - ball.fallSpeed).toBeLessThanOrEqual(.600001);
      boost.recordSuccessfulHit();
    }
    expect(ball.fallSpeed).toBeGreaterThan(initialSpeed * .88);
    expect(boost.tryBoost().success).toBe(true);
    expect(ball.fallSpeed).toBeGreaterThan(initialSpeed * 1.3);
  }
});
