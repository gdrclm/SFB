import { expect, it } from "vitest";
import { advanceMusicTempo, MAX_MUSIC_TEMPO, MIN_MUSIC_TEMPO, musicTempoForSpeed } from "./MusicTempo";

it("slows baseline music slightly and gives successive speed bands audible room to grow", () => {
  for (const [speed, tempo] of [[10, .9], [30, 1], [70, 1.1], [150, 1.2]] as const) {
    expect(musicTempoForSpeed(speed)).toBeCloseTo(tempo, 10);
  }
  expect(musicTempoForSpeed(300)).toBe(MAX_MUSIC_TEMPO);
  expect(musicTempoForSpeed(0)).toBe(MIN_MUSIC_TEMPO);
});

it("scales against the configured baseline instead of treating every character as speed ten", () => {
  expect(musicTempoForSpeed(20, 20)).toBeCloseTo(.9);
  expect(musicTempoForSpeed(60, 20)).toBeCloseTo(1);
  expect(musicTempoForSpeed(140, 20)).toBeCloseTo(1.1);
});

it("is monotonic and bounded through slow motion, repeated boosts and extreme speeds", () => {
  const speeds = [-10, 0, 5, 10, 15, 22.5, 33.75, 50.625, 70, 100, 150, 300, 100_000];
  let previous = MIN_MUSIC_TEMPO;
  for (const speed of speeds) {
    const tempo = musicTempoForSpeed(speed);
    expect(tempo).toBeGreaterThanOrEqual(previous);
    expect(tempo).toBeGreaterThanOrEqual(MIN_MUSIC_TEMPO);
    expect(tempo).toBeLessThanOrEqual(MAX_MUSIC_TEMPO);
    previous = tempo;
  }
});

it("handles invalid speeds and baselines without sending invalid rates to the browser", () => {
  for (const speed of [NaN, Infinity, -Infinity]) expect(musicTempoForSpeed(speed)).toBe(MIN_MUSIC_TEMPO);
  for (const baseline of [NaN, Infinity, -Infinity, 0, -10]) {
    expect(musicTempoForSpeed(30, baseline)).toBeCloseTo(1);
  }
  expect(musicTempoForSpeed(30, Number.MIN_VALUE)).toBe(MAX_MUSIC_TEMPO);
});

it("eases into boosts and back to the original slower tempo without overshoot", () => {
  const raised = advanceMusicTempo(.9, 1.2, 1 / 60);
  expect(raised).toBeGreaterThan(.9);
  expect(raised).toBeLessThan(1.2);
  let rate = raised;
  for (let frame = 0; frame < 120; frame++) rate = advanceMusicTempo(rate, 1.2, 1 / 60);
  expect(rate).toBeGreaterThan(1.199);
  for (let frame = 0; frame < 180; frame++) {
    rate = advanceMusicTempo(rate, .9, 1 / 60);
    expect(rate).toBeGreaterThanOrEqual(.9);
    expect(rate).toBeLessThan(1.2);
  }
  expect(rate).toBeCloseTo(.9, 4);
});

it("has the same response at different frame rates and freezes on invalid elapsed time", () => {
  const run = (fps: number): number => {
    let rate = .9;
    for (let i = 0; i < fps; i++) rate = advanceMusicTempo(rate, 1.25, 1 / fps);
    return rate;
  };
  expect(run(30)).toBeCloseTo(run(60), 12);
  expect(run(60)).toBeCloseTo(run(144), 12);
  for (const seconds of [0, -1, NaN, Infinity]) expect(advanceMusicTempo(1.1, .9, seconds)).toBe(1.1);
  expect(advanceMusicTempo(NaN, 1.1, 0)).toBe(MIN_MUSIC_TEMPO);
  expect(advanceMusicTempo(3, 4, .1)).toBe(MAX_MUSIC_TEMPO);
});
