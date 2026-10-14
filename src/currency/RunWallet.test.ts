import { describe, expect, it } from "vitest";
import { RunWallet } from "./RunWallet";

describe("RunWallet", () => {
  it("adds one coin and two energy", () => {
    const wallet = new RunWallet(30, 2);

    wallet.collectCoin();

    expect(wallet.coins).toBe(1);
    expect(wallet.energy).toBe(32);
  });

  it("spends shared energy without allowing a negative balance", () => {
    const wallet = new RunWallet(3, 2);

    expect(wallet.spendEnergy(2.5)).toBe(true);
    expect(wallet.energy).toBe(0.5);
    expect(wallet.spendEnergy(1)).toBe(false);
    expect(wallet.energy).toBe(0.5);
  });

  it("drains the remaining energy without crossing zero", () => {
    const wallet = new RunWallet(1, 2);

    expect(wallet.drainEnergy(1.5)).toBe(1);
    expect(wallet.energy).toBe(0);
  });

  it("adds platform energy without adding a coin", () => {
    const wallet = new RunWallet(30, 2);

    expect(wallet.addEnergy(10)).toBe(40);
    expect(wallet.energy).toBe(40);
    expect(wallet.coins).toBe(0);
  });

  it("rejects an invalid energy reward", () => {
    const wallet = new RunWallet(30, 2);

    expect(() => wallet.addEnergy(0)).toThrow(RangeError);
    expect(() => wallet.addEnergy(Number.NaN)).toThrow(RangeError);
  });
});
