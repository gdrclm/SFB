import { expect, it, vi } from "vitest";
import { GraphicsSettings, GRAPHICS_STORAGE_KEY } from "./GraphicsSettings";

it("restores a device-wide preset and leaves progress and other preferences alone", () => {
  const values = new Map([["speed-fall-ball.profile.v1", "coins"], ["speed-fall-ball.effects-enabled", "false"]]);
  const storage = { getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); } };
  const settings = new GraphicsSettings(() => storage), changed = vi.fn();
  settings.subscribe(changed);
  expect(settings.mode).toBe("auto");
  settings.set("ultra");settings.set("ultra");
  expect(changed).toHaveBeenCalledTimes(1);
  expect(new GraphicsSettings(() => storage).mode).toBe("ultra");
  expect(values.get("speed-fall-ball.profile.v1")).toBe("coins");
  expect(values.get("speed-fall-ball.effects-enabled")).toBe("false");
  settings.set("auto");expect(new GraphicsSettings(() => storage).mode).toBe("auto");
  values.set(GRAPHICS_STORAGE_KEY, "broken");expect(new GraphicsSettings(() => storage).mode).toBe("auto");
});

it("changes quality when storage is blocked and releases removed listeners", () => {
  const settings = new GraphicsSettings(() => { throw Error("Storage blocked"); }), changed = vi.fn();
  const unsubscribe = settings.subscribe(changed);
  settings.set("high");expect(settings.mode).toBe("high");expect(changed).toHaveBeenCalledTimes(1);
  unsubscribe();settings.set("low");expect(settings.mode).toBe("low");expect(changed).toHaveBeenCalledTimes(1);
});
