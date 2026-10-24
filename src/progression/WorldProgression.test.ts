import { expect, it } from "vitest";
import { worldProgression } from "./WorldProgression";
it.each([
  [0, "sky", "introduction"], [499.99, "sky", "climax"],
  [500, "crystal", "introduction"], [999.99, "crystal", "introduction"],
  [1000, "crystal", "development"], [2199.99, "crystal", "development"],
  [2200, "crystal", "climax"], [2999.99, "crystal", "climax"],
  [3000, "lava", "introduction"], [5000, "lava", "development"], [9500, "lava", "climax"],
  [11999.99, "lava", "climax"], [12000, "abyss", "introduction"],
  [15000, "abyss", "development"], [21000, "abyss", "climax"], [1000000, "abyss", "climax"],
] as const)("selects the world and internal phase at %s m", (depth, location, phase) => {
  expect(worldProgression(depth)).toMatchObject({ location, phase });
});
it("reintroduces space at a new world instead of carrying the previous climax into it", () => {
  const finale = worldProgression(2999), entrance = worldProgression(3000);
  expect(entrance.passageExtra).toBeGreaterThan(finale.passageExtra);
  expect(entrance.spacingScale).toBeGreaterThan(finale.spacingScale);
  for (const depth of [NaN, Infinity, -50]) expect(worldProgression(depth)).toMatchObject({ location: "sky", phase: "introduction" });
});
