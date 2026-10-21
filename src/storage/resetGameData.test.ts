import { expect, it } from "vitest";
import { resetGameData } from "./resetGameData";

function storageFixture() {
  const data = new Map([
    ["speed-fall-ball.profile.v1", "purchases, coins, missions"],
    ["speed-fall-ball.run-history.v1", "records"],
    ["speed-fall-ball.music-enabled", "false"],
    ["speed-fall-ball.guided-opening.v1", "true"],
    ["other-project.save", "keep"],
  ]);
  const storage = {
    get length() { return data.size; },
    key: (index: number) => [...data.keys()][index] ?? null,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); },
    removeItem: (key: string) => { data.delete(key); },
  };
  return { data, storage };
}

it("clears all SFB progress and preferences without deleting other projects on the same origin", () => {
  const { data, storage } = storageFixture();
  resetGameData(storage);
  expect([...data]).toEqual([["other-project.save", "keep"]]);
  resetGameData(storage);
  expect([...data]).toEqual([["other-project.save", "keep"]]);
});

it("restores removed values and reports failure if deletion is interrupted", () => {
  const { data, storage } = storageFixture();
  const before = new Map(data);
  storage.removeItem = (key: string) => {
    if (key.includes("run-history")) throw new Error("Storage blocked");
    data.delete(key);
  };
  expect(() => { resetGameData(storage); }).toThrow("Storage blocked");
  expect(data).toEqual(before);
});
