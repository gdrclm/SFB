import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Haptics, HAPTIC_PATTERNS } from "./Haptics";

function fixture(result = true) {
  let allowed = true;
  const vibrate = vi.fn<(pattern: number | number[]) => boolean>(() => result);
  const engine = new Haptics({ vibrate, allowed: () => allowed, now: () => Date.now() });
  return { engine, vibrate, setAllowed: (value: boolean) => { allowed = value; } };
}
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(0); });
afterEach(() => { vi.useRealTimers(); });

describe("physical haptics arbitration", () => {
  it("plays the strongest collision pattern instead of stacking boost, break and coin", () => {
    const { engine, vibrate } = fixture();
    engine.request("coin"); engine.request("boost"); engine.request("heavyBreak");
    vi.advanceTimersByTime(25);
    expect(vibrate).toHaveBeenCalledExactlyOnceWith([15, 25, 25]);
    vi.advanceTimersByTime(1000);
    expect(vibrate).toHaveBeenCalledTimes(1);
  });

  it("uses one consolidated last-life warning instead of bounce + impact + life pulses", () => {
    const { engine, vibrate } = fixture();
    engine.request("bounce"); engine.request("blockedImpact"); engine.request("lifeLost"); engine.request("lastLife");
    vi.advanceTimersByTime(20);
    expect(vibrate).toHaveBeenCalledExactlyOnceWith([65, 75, 35]);
  });

  it("samples a burst of ten coins and accents a completed rich chain once", () => {
    const { engine, vibrate } = fixture();
    for (let i = 0; i < 10; i++) { engine.request("coin"); vi.advanceTimersByTime(40); }
    expect(vibrate).toHaveBeenCalledExactlyOnceWith([6]);
    engine.request("coin"); engine.request("richChain"); vi.advanceTimersByTime(20);
    expect(vibrate.mock.calls.map((call) => call[0])).toEqual([[6], [8, 35, 12]]);
  });

  it("does not let a menu/coin cancel a physical impact, but lets life loss preempt it", () => {
    const { engine, vibrate } = fixture();
    engine.request("heavyBreak"); vi.advanceTimersByTime(20);
    engine.request("coin"); engine.request("menu"); vi.advanceTimersByTime(20);
    expect(vibrate).toHaveBeenCalledTimes(1);
    engine.request("lifeLost"); vi.advanceTimersByTime(20);
    expect(vibrate).toHaveBeenLastCalledWith([65]);
  });

  it("cancels pending and active feedback when paused, hidden or disabled", () => {
    const { engine, vibrate, setAllowed } = fixture();
    engine.request("boost"); engine.cancel(); vi.advanceTimersByTime(50);
    expect(vibrate).not.toHaveBeenCalled();
    engine.request("boost"); vi.advanceTimersByTime(20); engine.setEnabled(false);
    expect(vibrate).toHaveBeenLastCalledWith(0);
    const count = vibrate.mock.calls.length;
    engine.request("lifeLost"); vi.advanceTimersByTime(200);
    expect(vibrate).toHaveBeenCalledTimes(count);
    engine.setEnabled(true); engine.request("phase"); setAllowed(false); vi.advanceTimersByTime(20);
    expect(vibrate).toHaveBeenCalledTimes(count);
    setAllowed(true); vi.advanceTimersByTime(1000);
    expect(vibrate).toHaveBeenCalledTimes(count);
  });

  it("requires an activated visible device and survives unsupported/rejected APIs", () => {
    const absent = new Haptics(null); absent.request("boost"); expect(absent.available).toBe(false);
    const { engine, vibrate, setAllowed } = fixture(false);
    setAllowed(false); engine.request("boost"); vi.advanceTimersByTime(20);
    expect(vibrate).not.toHaveBeenCalled();
    setAllowed(true); const notify = vi.fn(); engine.subscribe(notify);
    engine.request("boost"); vi.advanceTimersByTime(20);
    expect(engine.available).toBe(false); expect(notify).toHaveBeenCalledOnce();
    engine.request("coin"); vi.advanceTimersByTime(20); expect(vibrate).toHaveBeenCalledOnce();
  });

  it("never emits unavailable-boost or menu feedback without an explicit event", () => {
    const { engine, vibrate } = fixture();
    vi.advanceTimersByTime(5000); expect(vibrate).not.toHaveBeenCalled();
    engine.request("boostUnavailable"); vi.advanceTimersByTime(20);
    expect(vibrate).toHaveBeenCalledExactlyOnceWith([5]);
    engine.request("boostUnavailable"); vi.advanceTimersByTime(20);
    expect(vibrate).toHaveBeenCalledOnce();
  });

  it("keeps all actuator patterns short, finite and within the specified impulse ranges", () => {
    for (const event of Object.values(HAPTIC_PATTERNS)) {
      expect(event.pattern.length % 2).toBe(1);
      expect(event.pattern.every((ms) => ms > 0 && ms <= 80)).toBe(true);
      expect(event.pattern.reduce<number>((a: number, b: number) => a + b, 0)).toBeLessThan(250);
    }
    expect(HAPTIC_PATTERNS.weakBreak.pattern[0]).toBeGreaterThanOrEqual(8);
    expect(HAPTIC_PATTERNS.weakBreak.pattern[0]).toBeLessThanOrEqual(12);
    expect(HAPTIC_PATTERNS.normalBreak.pattern[0]).toBeGreaterThanOrEqual(15);
    expect(HAPTIC_PATTERNS.normalBreak.pattern[0]).toBeLessThanOrEqual(20);
    expect(HAPTIC_PATTERNS.boost.pattern).toEqual([15, 25, 30]);
  });
});
