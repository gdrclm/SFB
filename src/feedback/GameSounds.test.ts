import { expect, it } from "vitest";
import { coinPitch } from "./GameSounds";
it("raises chain notes musically while keeping long chains in a bounded register", () => {
  expect(coinPitch(0)).toBe(1);
  expect(coinPitch(1)).toBeGreaterThan(coinPitch(0));
  expect(coinPitch(4)).toBeGreaterThan(coinPitch(3));
  expect(coinPitch(50)).toBe(2);
  expect(coinPitch(-1)).toBe(1);
});
