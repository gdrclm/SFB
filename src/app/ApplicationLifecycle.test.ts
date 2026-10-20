import { describe, expect, it, vi } from "vitest";
import type { LifecycleApplication } from "./ApplicationLifecycle";
import { ApplicationLifecycle } from "./ApplicationLifecycle";

function createApplication(): {
  application: LifecycleApplication;
  start: ReturnType<typeof vi.fn>;
  dispose: ReturnType<typeof vi.fn>;
  reset: ReturnType<typeof vi.fn>;
} {
  const start = vi.fn(async () => Promise.resolve());
  const dispose = vi.fn();
  const reset = vi.fn(async () => Promise.resolve());
  return {
    application: { start, reset, dispose },
    reset,
    start,
    dispose,
  };
}

describe("ApplicationLifecycle", () => {
  it("creates a fresh application after a page restoration", async () => {
    const first = createApplication();
    const second = createApplication();
    const create = vi.fn()
      .mockReturnValueOnce(first.application)
      .mockReturnValueOnce(second.application);
    const lifecycle = new ApplicationLifecycle(create);

    await lifecycle.restart();
    lifecycle.dispose();
    await lifecycle.restart();

    expect(create).toHaveBeenCalledTimes(2);
    expect(first.dispose).toHaveBeenCalledOnce();
    expect(second.start).toHaveBeenCalledOnce();
  });

  it("resets the existing application without re-creating or disposing it", async () => {
    const first = createApplication();
    const create = vi.fn(() => first.application);
    const lifecycle = new ApplicationLifecycle(create);
    await lifecycle.restart();
    await lifecycle.restart();
    await lifecycle.restart();
    expect(create).toHaveBeenCalledOnce();
    expect(first.start).toHaveBeenCalledOnce();
    expect(first.reset).toHaveBeenCalledTimes(2);
    expect(first.dispose).not.toHaveBeenCalled();
  });

  it("releases a failed reset so another start can recover", async () => {
    const first = createApplication();
    const second = createApplication();
    const create = vi.fn().mockReturnValueOnce(first.application).mockReturnValueOnce(second.application);
    const lifecycle = new ApplicationLifecycle(create);
    await lifecycle.restart();
    first.reset.mockRejectedValueOnce(new Error("reset failed"));
    await expect(lifecycle.restart()).rejects.toThrow("reset failed");
    expect(first.dispose).toHaveBeenCalledOnce();
    await lifecycle.restart();
    expect(second.start).toHaveBeenCalledOnce();
  });
});
