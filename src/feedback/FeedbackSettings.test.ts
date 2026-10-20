import { describe, expect, it } from "vitest";
import { FeedbackSettings } from "./FeedbackSettings";

describe("independent feedback preferences", () => {
  it("migrates old sound-off without disabling vibration and persists each channel separately", () => {
    const values = new Map([["speed-fall-ball.sound-enabled", "false"]]);
    const storage = { getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); } };
    const settings = new FeedbackSettings(() => storage);
    expect(settings.get("music")).toBe(false);
    expect(settings.get("effects")).toBe(false);
    expect(settings.get("vibration")).toBe(true);
    settings.set("music", true); settings.set("vibration", false);
    const restored = new FeedbackSettings(() => storage);
    expect(restored.get("music")).toBe(true);
    expect(restored.get("effects")).toBe(false);
    expect(restored.get("vibration")).toBe(false);
  });
  it("still changes preferences in-session when storage is unavailable", () => {
    const settings = new FeedbackSettings(() => { throw new Error("Storage blocked"); });
    settings.set("effects", false);
    expect(settings.get("music")).toBe(true);
    expect(settings.get("effects")).toBe(false);
    expect(settings.get("vibration")).toBe(true);
  });
});
