import { expect, it } from "vitest";
import { DepthLocations } from "./DepthLocations";

it("changes locations at distance boundaries and cycles during long runs", () => {
  const world = new DepthLocations();
  expect(world.observe(0)).toBe("sky");
  expect(world.observe(499)).toBe("sky");
  expect(world.observe(500)).toBe("crystal");
  expect(world.observe(1000)).toBe("lava");
  expect(world.observe(1500)).toBe("abyss");
  expect(world.observe(2000)).toBe("sky");
  expect(world.observe(9500)).toBe("abyss");
});
it("does not rewind on bounces or invalid input; a new run starts in the sky", () => {
  const world = new DepthLocations();
  world.observe(520);
  for (const depth of [490, -1, NaN, Infinity]) expect(world.observe(depth)).toBe("crystal");
  expect(new DepthLocations().observe(0)).toBe("sky");
});
