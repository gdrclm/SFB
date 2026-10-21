import { expect, it } from "vitest";
import { DepthLocations } from "./DepthLocations";

it("opens locations at 500, 1500 and 4000 metres without cycling", () => {
  const world = new DepthLocations();
  expect(world.observe(0)).toBe("sky");
  expect(world.observe(499)).toBe("sky");
  expect(world.observe(500)).toBe("crystal");
  expect(world.observe(1000)).toBe("crystal");
  expect(world.observe(1499.99)).toBe("crystal");
  expect(world.observe(1500)).toBe("lava");
  expect(world.observe(3999.99)).toBe("lava");
  expect(world.observe(4000)).toBe("abyss");
  expect(world.observe(9500)).toBe("abyss");
});
it("does not rewind on bounces or invalid input; a new run starts in the sky", () => {
  const world = new DepthLocations();
  world.observe(520);
  for (const depth of [490, -1, NaN, Infinity]) expect(world.observe(depth)).toBe("crystal");
  world.observe(4000);
  for (const depth of [3900, 1500, 500, 0]) expect(world.observe(depth)).toBe("abyss");
  expect(new DepthLocations().observe(0)).toBe("sky");
});
