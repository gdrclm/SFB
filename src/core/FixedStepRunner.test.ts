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

  it("stops remaining systems and catch-up steps immediately when the run ends", () => {
    let playing = true;
    const finishRun = vi.fn(() => { playing = false; });
    const laterSystem = vi.fn();
    const runner = new FixedStepRunner(0.02, 0.1);
    runner.register({ fixedUpdate: finishRun });
    runner.register({ fixedUpdate: laterSystem });
    runner.advance(0.1, 1, () => playing);
    expect(finishRun).toHaveBeenCalledOnce();
    expect(laterSystem).not.toHaveBeenCalled();
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

it("clears old systems and pending time between runs", () => {
  const runner = new FixedStepRunner(.02, .1);
  const old = vi.fn(); const next = vi.fn();
  runner.register({ fixedUpdate: old });
  runner.advance(.01);
  runner.clear();
  runner.register({ fixedUpdate: next });
  runner.advance(.01);
  expect(old).not.toHaveBeenCalled();
  expect(next).not.toHaveBeenCalled();
  runner.advance(.01);
  expect(next).toHaveBeenCalledOnce();
});
