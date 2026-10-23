import { afterEach, describe, expect, it, vi } from "vitest";
import { WindCanvas } from "./WindCanvas";

function setup(reduced = false) {
  const gradient = { addColorStop: vi.fn() };
  const context = { createLinearGradient: () => gradient, fillRect: vi.fn(), clearRect: vi.fn(), setTransform: vi.fn(), drawImage: vi.fn(), save: vi.fn(), beginPath: vi.fn(), rect: vi.fn(), clip: vi.fn(), restore: vi.fn(), globalAlpha: 1 };
  const root = { clientWidth: 390, clientHeight: 844, append: vi.fn(), classList: { add: vi.fn(), remove: vi.fn() } };
  const canvas = { width: 0, height: 0, setAttribute: vi.fn(), getContext: () => context, remove: vi.fn(), parentElement: root };
  const disconnect = vi.fn();
  vi.stubGlobal("document", { createElement: () => ({ ...canvas }) });
  vi.stubGlobal("window", { matchMedia: () => ({ matches: reduced }) });
  vi.stubGlobal("ResizeObserver", class { observe() { /* Initial size is read synchronously. */ } disconnect = disconnect; });
  return { wind: new WindCanvas(root as unknown as HTMLElement), context, root, disconnect };
}

afterEach(() => vi.unstubAllGlobals());

describe("mobile canvas wind", () => {
  it("draws real beams immediately on both edges and increases coverage with speed", () => {
    const { wind, context } = setup();
    wind.configure(10, false); wind.draw(.016);
    expect(context.drawImage).not.toHaveBeenCalled();
    wind.configure(20, false); wind.draw(.016);
    const slow = context.drawImage.mock.calls as unknown as [unknown, number, number, number, number][];
    expect(slow.some(([, x, y]) => x < 50 && y < 844 && y > -844)).toBe(true);
    expect(slow.some(([, x, y]) => x > 340 && y < 844 && y > -844)).toBe(true);
    const count = slow.length;
    const length = slow[0]?.[4] ?? 0;
    context.drawImage.mockClear();
    wind.configure(320, false); wind.draw(.016);
    expect(context.drawImage.mock.calls.length).toBeGreaterThan(count);
    expect((context.drawImage.mock.calls as unknown as [unknown, number, number, number, number][])[0]?.[4]).toBeGreaterThan(length);
    wind.dispose();
  });

  it("freezes on pause, removes its canvas on exit, and disconnects resize observation", () => {
    const { wind, context, root, disconnect } = setup();
    wind.configure(80, false); wind.draw(.016);
    wind.configure(80, true); context.drawImage.mockClear(); wind.draw(1);
    expect(context.drawImage).not.toHaveBeenCalled();
    wind.configure(80, false); wind.draw(.016);
    expect(context.drawImage).toHaveBeenCalled();
    wind.dispose();
    expect(root.classList.remove).toHaveBeenCalledWith("canvas-wind");
    expect(disconnect).toHaveBeenCalledOnce();
  });

  it("keeps static visible rays with reduced motion and draws a boost burst even at low speed", () => {
    const { wind, context } = setup(true);
    wind.configure(20, false); wind.draw(.016);
    expect(context.drawImage).toHaveBeenCalled();
    context.drawImage.mockClear(); wind.draw(.016);
    expect(context.drawImage).not.toHaveBeenCalled();
    wind.configure(0, false); wind.draw(.016);
    wind.boost(); wind.draw(.016);
    expect(context.drawImage).toHaveBeenCalled();
    wind.dispose();
  });
});
