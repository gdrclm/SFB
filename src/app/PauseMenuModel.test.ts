import { describe, expect, it } from "vitest";
import { createPauseMenuSummary } from "./PauseMenuModel";

describe("createPauseMenuSummary", () => {
  it("formats the current run result and mission progress", () => {
    const summary = createPauseMenuSummary({
      depth: 127.6,
      coins: 23,
      destroyedPlatforms: 4,
      stage: 3,
      stageTarget: 10,
      coinTarget: 50,
      platformTarget: 10,
    });

    expect(summary.depthLabel).toBe("128 М");
    expect(summary.coinLabel).toBe("23");
    expect(summary.coinsMission).toEqual({
      current: 23,
      target: 50,
      ratio: 0.46,
      label: "23/50",
    });
    expect(summary.platformsMission.label).toBe("4/10");
    expect(summary.stageMission.ratio).toBe(0.3);
  });

  it("clamps completed missions and invalid negative values", () => {
    const summary = createPauseMenuSummary({
      depth: -12,
      coins: 80,
      destroyedPlatforms: -3,
      stage: 15,
      stageTarget: 10,
      coinTarget: 50,
      platformTarget: 10,
    });

    expect(summary.depthLabel).toBe("0 М");
    expect(summary.coinsMission.label).toBe("50/50");
    expect(summary.coinsMission.ratio).toBe(1);
    expect(summary.platformsMission.label).toBe("0/10");
    expect(summary.stageMission.label).toBe("10/10");
  });
});
