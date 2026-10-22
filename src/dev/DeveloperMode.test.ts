import { expect, it } from "vitest";
import { gameConfig } from "../config/gameConfig";
import { atStartDepth, parseStartDepth } from "./DeveloperMode";
import { RunProgress } from "../run/RunHistory";

it.each(["", " ", "-1", "1.5", "Infinity", "NaN", "1000001"])("rejects invalid starting depth %s", value => {
  expect(parseStartDepth(value)).toBeNull();
});
it.each([0, 499, 500, 1500, 4000, 1000000])("starts the complete playfield at %s metres without mutating defaults", depth => {
  expect(parseStartDepth(String(depth))).toBe(depth);
  const config = atStartDepth(gameConfig, depth);
  expect(config.ball.startPosition.y).toBe(4.5 - depth);
  for (let i = 0; i < config.platforms.length; i++) {
    expect((config.platforms[i]?.position.y ?? NaN) - config.ball.startPosition.y)
      .toBe((gameConfig.platforms[i]?.position.y ?? NaN) - gameConfig.ball.startPosition.y);
  }
  expect((config.coins.positions[0]?.y ?? NaN)).toBeCloseTo((gameConfig.coins.positions[0]?.y ?? NaN) - depth);
  expect(gameConfig.ball.startPosition.y).toBe(4.5);
});
it("can finish a developer run without any persistent history", () => {
  const progress = new RunProgress();
  progress.observeDepth(4000);
  const result = progress.finish(null, 10, 5, "completed");
  expect(result.depth).toBe(4000);
  expect(progress.finish(null, 10, 5, "interrupted")).toBe(result);
});
