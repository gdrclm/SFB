import { expect, it } from "vitest";
import { coinPitch, breakSoundProfile, speedSoundProfile, whistleSoundProfile } from "./GameSounds";
it("raises chain notes musically while keeping long chains in a bounded register", () => {
  expect(coinPitch(0)).toBe(1);
  expect(coinPitch(1)).toBeGreaterThan(coinPitch(0));
  expect(coinPitch(4)).toBeGreaterThan(coinPitch(3));
  expect(coinPitch(50)).toBe(2);
  expect(coinPitch(-1)).toBe(1);
});
it("shortens and strengthens fast three-layer impacts while preserving material identity and a distinct earned-power pitch",()=>{
 const slow=breakSoundProfile("stone",10),fast=breakSoundProfile("stone",120),power=breakSoundProfile("stone",120,true);
 expect(fast.duration).toBeLessThan(slow.duration);expect(fast.gain).toBeGreaterThan(slow.gain);
 expect(power.duration).toBeLessThan(fast.duration);expect(power.whistle).toBeGreaterThan(fast.whistle);
 expect(breakSoundProfile("bubble",80).crack).toBeLessThan(breakSoundProfile("stone",80).crack);
 expect(breakSoundProfile("cloud",80).thump).not.toBe(breakSoundProfile("stone",80).thump);
});

it("ramps the high-speed whistle only above 70 and limits its volume", () => {
  expect(whistleSoundProfile(70).gain).toBe(0);
  expect(whistleSoundProfile(71).gain).toBeGreaterThan(0);
  expect(whistleSoundProfile(140).gain).toBeGreaterThan(whistleSoundProfile(90).gain);
  expect(whistleSoundProfile(1e12).gain).toBe(.018);
});

it("adds a bounded low-frequency speed layer only after the early game", () => {
  expect(speedSoundProfile(10).gain).toBe(0);
  const medium = speedSoundProfile(40), fast = speedSoundProfile(160);
  expect(fast.gain).toBeGreaterThan(medium.gain);
  expect(fast.frequency).toBeGreaterThan(medium.frequency);
  expect(fast.frequency).toBeLessThan(90);
  expect(speedSoundProfile(1e12).gain).toBe(.035);
  expect(speedSoundProfile(NaN).gain).toBe(0);
});
