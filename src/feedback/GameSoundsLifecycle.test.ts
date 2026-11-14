import { afterEach, expect, it, vi } from "vitest";
import { GameSounds } from "./GameSounds";

function fixture() {
  const events = new Map<string, (event: { isTrusted: boolean }) => void>();
  const page = { hidden: false, hasFocus: () => true, documentElement: { dataset: { effectsEnabled: "true" } },
    addEventListener: (name: string, listener: (event: { isTrusted: boolean }) => void) => events.set(name, listener) };
  const param = () => ({ setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn(), setTargetAtTime: vi.fn() });
  const source = () => ({ connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(), frequency: param(), onended: null });
  const oscillators: ReturnType<typeof source>[] = [];
  const context = { state: "running", currentTime: 0, sampleRate: 48000, destination: {},
    createOscillator: () => { const node = source(); oscillators.push(node); return node; },
    createGain: () => ({ gain: param(), connect: vi.fn(), disconnect: vi.fn() }),
    createBiquadFilter: () => ({ frequency: param(), connect: vi.fn(), disconnect: vi.fn() }),
    createBuffer: () => ({ getChannelData: () => new Float32Array(16) }), createBufferSource: source };
  vi.stubGlobal("document", page);
  vi.stubGlobal("window", { addEventListener: page.addEventListener });
  vi.stubGlobal("MutationObserver", class { observe() {} });
  vi.stubGlobal("AudioContext", vi.fn(function () { return context; }));
  const sound = new GameSounds();
  events.get("pointerdown")?.({ isTrusted: true });
  return { sound, page, context, oscillators, events };
}
afterEach(() => vi.unstubAllGlobals());

it("reuses one speed voice and disconnects it on pause, mute, hidden page and blur", () => {
  const { sound, page, oscillators, events } = fixture();
  for (let i = 0; i < 120; i++) sound.updateSpeed(40 + i / 10, true);
  expect(oscillators).toHaveLength(1);
  sound.updateSpeed(160, false);
  expect(oscillators[0]?.disconnect).toHaveBeenCalledOnce();
  sound.updateSpeed(60, true); expect(oscillators).toHaveLength(2);
  page.documentElement.dataset.effectsEnabled = "false"; sound.updateSpeed(160, true);
  expect(oscillators[1]?.disconnect).toHaveBeenCalledOnce();
  sound.updateSpeed(160, true); expect(oscillators).toHaveLength(2);
  page.documentElement.dataset.effectsEnabled = "true"; sound.updateSpeed(60, true);
  page.hidden = true; events.get("visibilitychange")?.({ isTrusted: true });
  expect(oscillators[2]?.disconnect).toHaveBeenCalledOnce();
  page.hidden = false; sound.updateSpeed(60, true); events.get("blur")?.({ isTrusted: true });
  expect(oscillators[3]?.disconnect).toHaveBeenCalledOnce();
});

it("starts the whistle above 70, reuses it and removes it again as speed drops", () => {
  const { sound, oscillators } = fixture();
  sound.updateSpeed(70, true); expect(oscillators).toHaveLength(1);
  for (let i = 0; i < 30; i++) sound.updateSpeed(90 + i, true);
  expect(oscillators).toHaveLength(2);
  sound.updateSpeed(70, true); expect(oscillators[1]?.disconnect).toHaveBeenCalledOnce();
  sound.stop(); expect(oscillators[0]?.disconnect).toHaveBeenCalledOnce();
});

it("plays a rising overtone after a fracture and throttles it across very dense hits", () => {
  const { sound, oscillators, context } = fixture();
  sound.play("break", 1.4);
  expect(oscillators).toHaveLength(2);
  const rise = oscillators[1];
  expect(rise?.frequency.setValueAtTime).toHaveBeenCalledWith(360, .025);
  expect(rise?.frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(1400, .155);
  context.currentTime = .05; sound.play("break");
  expect(oscillators).toHaveLength(3);
  context.currentTime = .2; sound.play("break");
  expect(oscillators).toHaveLength(5);
  sound.stop();
  expect(oscillators.every(node => node.stop.mock.calls.length > 0)).toBe(true);
});
