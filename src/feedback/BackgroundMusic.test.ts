import { expect, it, vi } from "vitest";
import { BackgroundMusic } from "./BackgroundMusic";

function player() {
  const audio = { play: vi.fn().mockResolvedValue(undefined), pause: vi.fn(), loop: false, volume: 1 };
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
  music.unlock();
  expect(audio.play).toHaveBeenCalledTimes(2);
});
