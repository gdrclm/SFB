import { afterEach, expect, it, vi } from "vitest";
import { BackgroundMusic, initializeBackgroundMusic } from "./BackgroundMusic";

afterEach(() => { vi.unstubAllGlobals(); });

function player() {
  const audio = { play: vi.fn().mockResolvedValue(undefined), pause: vi.fn(), loop: false, volume: 1, currentTime: 0 };
  return { audio, music: new BackgroundMusic(audio) };
}

it("waits for interaction, loops quietly and does not duplicate playback requests", () => {
  const { audio, music } = player();
  music.setEnabled(true);
  expect(audio.play).not.toHaveBeenCalled();
  music.unlock(); music.unlock(); music.setEnabled(true);
  expect(audio.play).toHaveBeenCalledTimes(1);
  expect(audio.loop).toBe(true);
  expect(audio.volume).toBeLessThan(.5);
});

it("pauses when disabled or hidden and resumes without resetting the track", () => {
  const { audio, music } = player();
  music.unlock();
  expect(audio.play).not.toHaveBeenCalled();
  music.setEnabled(true);
  music.setVisible(false);
  const pauses = audio.pause.mock.calls.length;
  music.setEnabled(false); music.setVisible(true);
  expect(audio.play).toHaveBeenCalledTimes(1);
  expect(audio.pause.mock.calls.length).toBeGreaterThan(pauses);
  music.setEnabled(true);
  expect(audio.play).toHaveBeenCalledTimes(2);
});

it("retries on the next gesture after autoplay rejection", async () => {
  const { audio, music } = player();
  audio.play.mockRejectedValueOnce(new Error("NotAllowedError"));
  music.setEnabled(true); music.unlock();
  await Promise.resolve();
  await Promise.resolve();
  music.unlock();
  expect(audio.play).toHaveBeenCalledTimes(2);
});

function pair() {
  const { audio: sky } = player();
  const { audio: crystal } = player();
  const music = new BackgroundMusic(sky, crystal);
  music.setEnabled(true); music.unlock();
  return { sky, crystal, music };
}
function advance(music: BackgroundMusic, seconds: number): void {
  for (let i = 0; i < Math.round(seconds * 10); i++) music.update(.1);
}
async function settle(): Promise<void> { await Promise.resolve(); await Promise.resolve(); }

it("fades out sky for two seconds, then starts the crystal intro and fades it in", async () => {
  const { sky, crystal, music } = pair();
  expect(sky.play).toHaveBeenCalledTimes(1);
  expect(crystal.play).toHaveBeenCalledTimes(1);
  expect(crystal.volume).toBe(0);
  await settle();
  crystal.currentTime = 36;
  music.setCrystalBlend(1);
  expect(crystal.currentTime).toBe(36);
  advance(music, 1);
  expect(sky.volume).toBeCloseTo(.32 / Math.sqrt(2));
  expect(crystal.volume).toBe(0);
  advance(music, 1);
  expect(sky.volume).toBeCloseTo(0);
  expect(crystal.volume).toBeCloseTo(0);
  expect(crystal.currentTime).toBe(0);
  advance(music, 1);
  expect(sky.volume).toBeCloseTo(0);
  expect(crystal.volume).toBeCloseTo(.32 / Math.sqrt(2));
  advance(music, 1);
  expect(crystal.volume).toBeCloseTo(.32);
  expect(crystal.play).toHaveBeenCalledTimes(1);
});

it("does not restart on partial backdrop frames and freezes both phases on pause/hide/mute", async () => {
  const { sky, crystal, music } = pair();
  await settle(); music.setCrystalBlend(.5); advance(music, 3);
  const volume = crystal.volume;
  crystal.currentTime = 18;
  music.setCrystalBlend(1);
  music.setPaused(true); advance(music, 3);
  expect(crystal.volume).toBe(volume);
  expect(crystal.pause).toHaveBeenCalled();
  music.setPaused(false); await settle();
  music.setVisible(false); advance(music, 3);
  expect(crystal.volume).toBe(volume);
  music.setVisible(true); await settle();
  music.setEnabled(false); advance(music, 3);
  expect(crystal.volume).toBe(volume);
  music.setEnabled(true); await settle(); advance(music, 1);
  expect(crystal.currentTime).toBe(18);
  expect(crystal.volume).toBeCloseTo(.32);
  expect(sky.volume).toBeCloseTo(0);
});

it("freezes the first two seconds and never overlaps the two tracks during entry", async () => {
  const { sky, crystal, music } = pair();
  await settle();
  crystal.currentTime = 45;
  for (let i = 1; i <= 10; i++) {
    music.setCrystalBlend(i / 20);
    music.update(.1);
    expect(crystal.volume).toBe(0);
  }
  music.setPaused(true); advance(music, 5);
  expect(sky.volume).toBeCloseTo(.32 / Math.sqrt(2));
  expect(crystal.currentTime).toBe(45);
  music.setPaused(false); await settle();
  for (let i = 11; i <= 40; i++) {
    music.setCrystalBlend(Math.min(1, i / 20));
    music.update(.1);
    expect(sky.volume * crystal.volume).toBeCloseTo(0, 10);
    if (i < 20) expect(crystal.currentTime).toBe(45);
  }
  expect(crystal.currentTime).toBe(0);
  expect(crystal.volume).toBeCloseTo(.32);
});

it("keeps sky music until crystal playback succeeds and retries rejection on a gesture", async () => {
  const { audio: sky } = player();
  const { audio: crystal } = player();
  let reject!: (reason: Error) => void;
  crystal.play.mockImplementationOnce(() => new Promise<void>((_resolve, fail) => { reject = fail; }));
  const music = new BackgroundMusic(sky, crystal);
  music.setEnabled(true); music.unlock(); await settle();
  music.setCrystalBlend(1); advance(music, 10);
  expect(sky.volume).toBeCloseTo(.32);
  expect(crystal.volume).toBe(0);
  reject(new Error("NotAllowedError")); await settle(); advance(music, 10);
  expect(crystal.play).toHaveBeenCalledTimes(1);
  music.unlock(); await settle(); advance(music, 4);
  expect(crystal.play).toHaveBeenCalledTimes(2);
  expect(crystal.volume).toBeCloseTo(.32);
});

it("fades back on exit and restarts the intro on the next crystal entry", async () => {
  const { sky, crystal, music } = pair();
  await settle(); music.setCrystalBlend(1); advance(music, 4);
  music.setCrystalBlend(0); advance(music, 1);
  expect(sky.volume).toBeCloseTo(crystal.volume);
  advance(music, 1);
  expect(sky.volume).toBeCloseTo(.32);
  expect(crystal.volume).toBeCloseTo(0);
  crystal.currentTime = 95;
  music.setCrystalBlend(1);
  expect(crystal.currentTime).toBe(95);
  advance(music, 2);
  expect(crystal.currentTime).toBe(0);
});

it("does not revive a pending play after the page hides or jump after a long frame", async () => {
  const { audio: sky } = player();
  const { audio: crystal } = player();
  let resolve!: () => void;
  crystal.play.mockImplementationOnce(() => new Promise<void>(done => { resolve = done; }));
  const music = new BackgroundMusic(sky, crystal);
  music.setEnabled(true); music.unlock(); music.setCrystalBlend(1);
  music.setVisible(false);
  const pauses = crystal.pause.mock.calls.length;
  resolve(); await settle();
  expect(crystal.pause.mock.calls.length).toBeGreaterThan(pauses);
  music.setVisible(true); await settle(); music.update(100);
  expect(crystal.volume).toBe(0);
  expect(sky.volume).toBeLessThan(.32);
  expect(sky.volume).toBeGreaterThan(.3);
});

it("mixes through Web Audio gains when a mobile browser cannot set element volume", async () => {
  const { audio: sky } = player(), { audio: crystal } = player();
  const elements = [sky, crystal].map(audio => Object.assign(audio, {
    dataset: {}, preload: "", src: "", hidden: false, canPlayType: () => "",
  }));
  for (const element of elements) Object.defineProperty(element, "volume", {
    get: () => 1, set: () => { throw new Error("Element volume unsupported"); },
  });
  const gains = [0, 1].map(() => ({ gain: { value: 1, setTargetAtTime: vi.fn() }, connect: vi.fn() }));
  const resume = vi.fn().mockResolvedValue(undefined);
  const audioContext = {
    currentTime: 0, state: "suspended", resume, destination: {},
    createGain: vi.fn().mockReturnValueOnce(gains[0]).mockReturnValueOnce(gains[1]),
    createMediaElementSource: vi.fn(() => ({ connect: vi.fn() })),
  };
  const handlers = new Map<string, (event: Event) => void>();
  vi.stubGlobal("AudioContext", vi.fn(function () { return audioContext; }));
  vi.stubGlobal("document", {
    hidden: false, body: { append: vi.fn() },
    createElement: vi.fn().mockReturnValueOnce(elements[0]).mockReturnValueOnce(elements[1]),
    addEventListener: (name: string, handler: (event: Event) => void) => { handlers.set(name, handler); },
  });
  vi.stubGlobal("window", { addEventListener: vi.fn() });
  vi.stubGlobal("requestAnimationFrame", vi.fn());
  const music = initializeBackgroundMusic();
  expect(gains[0]?.gain.value).toBe(0);
  expect(gains[1]?.gain.value).toBe(0);
  music.setEnabled(true);
  handlers.get("pointerdown")?.({ isTrusted: true } as Event);
  await settle(); music.setCrystalBlend(1); advance(music, 4);
  expect(resume).toHaveBeenCalled();
  expect(crystal.play).toHaveBeenCalledTimes(1);
  expect(gains[0]?.gain.setTargetAtTime).toHaveBeenLastCalledWith(expect.closeTo(0), 0, .01);
  expect(gains[1]?.gain.setTargetAtTime).toHaveBeenLastCalledWith(expect.closeTo(.32), 0, .01);
});
