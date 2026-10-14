import { describe, expect, it, vi } from "vitest";
import type { LifecycleApplication } from "./ApplicationLifecycle";
import { ApplicationLifecycle } from "./ApplicationLifecycle";

function createApplication(): {
  application: LifecycleApplication;
  start: ReturnType<typeof vi.fn>;
  dispose: ReturnType<typeof vi.fn>;
} {
  const start = vi.fn(async () => Promise.resolve());
  const dispose = vi.fn();
  return {
    application: { start, dispose },
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

  it("disposes the current application before replacing it", async () => {
    const first = createApplication();
    const second = createApplication();
    const create = vi.fn()
      .mockReturnValueOnce(first.application)
      .mockReturnValueOnce(second.application);
    const lifecycle = new ApplicationLifecycle(create);

    await lifecycle.restart();
    await lifecycle.restart();

    expect(first.dispose).toHaveBeenCalledOnce();
    expect(second.start).toHaveBeenCalledOnce();
  });
});
