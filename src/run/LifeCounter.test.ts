import { describe, expect, it } from "vitest";
import { LifeCounter } from "./LifeCounter";

describe("LifeCounter", () => {
  it("subtracts one life per accepted hit", () => {
    const lives = new LifeCounter(3);

    expect(lives.loseLife()).toBe(true);
    expect(lives.remainingLives).toBe(2);
  });

  it("does not go below zero", () => {
    const lives = new LifeCounter(1);

    expect(lives.loseLife()).toBe(true);
    expect(lives.loseLife()).toBe(false);
    expect(lives.remainingLives).toBe(0);
  });

  it("restores health without exceeding the initial three lives", () => {
    const lives = new LifeCounter(3);
    lives.loseLife();

    expect(lives.restoreLives(1)).toBe(1);
    expect(lives.remainingLives).toBe(3);
    expect(lives.restoreLives(1)).toBe(0);
    expect(lives.remainingLives).toBe(3);
  });

  it("rejects an invalid health reward", () => {
    const lives = new LifeCounter(3);

    expect(() => lives.restoreLives(0)).toThrow(RangeError);
    expect(() => lives.restoreLives(1.5)).toThrow(RangeError);
  });
});
