import { describe, expect, it, vi } from "vitest";
import { FixedStepRunner } from "./FixedStepRunner";

describe("FixedStepRunner", () => {
  it("advances systems in deterministic fixed increments", () => {
    const fixedUpdate = vi.fn<
      (delta: number, realDelta?: number) => void
    >();
    const runner = new FixedStepRunner(0.02, 0.1);
    runner.register({ fixedUpdate });

    runner.advance(0.05);

    expect(fixedUpdate).toHaveBeenCalledTimes(2);
    expect(fixedUpdate).toHaveBeenNthCalledWith(1, 0.02, 0.02);
    expect(fixedUpdate).toHaveBeenNthCalledWith(2, 0.02, 0.02);
  });

  it("clamps long frames", () => {
    const fixedUpdate = vi.fn<
      (delta: number, realDelta?: number) => void
    >();
    const runner = new FixedStepRunner(0.02, 0.1);
    runner.register({ fixedUpdate });

    runner.advance(2);

    expect(fixedUpdate).toHaveBeenCalledTimes(5);
  });

  it("keeps fixed update frequency while scaling game time", () => {
    const fixedUpdate = vi.fn<
      (delta: number, realDelta?: number) => void
    >();
    const runner = new FixedStepRunner(0.02, 0.1);
    runner.register({ fixedUpdate });

    runner.advance(0.05, 0.1);

    expect(fixedUpdate).toHaveBeenCalledTimes(2);
    expect(fixedUpdate).toHaveBeenNthCalledWith(1, 0.002, 0.02);
    expect(fixedUpdate).toHaveBeenNthCalledWith(2, 0.002, 0.02);
  });
});
