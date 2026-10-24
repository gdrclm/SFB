import { expect, it } from "vitest";
import { DepthLocations } from "./DepthLocations";

it("opens locations at 500, 3000 and 12000 metres without cycling", () => {
  const world = new DepthLocations();
  expect(world.observe(0)).toBe("sky");
  expect(world.observe(499)).toBe("sky");
  expect(world.observe(500)).toBe("crystal");
  expect(world.observe(1000)).toBe("crystal");
  expect(world.observe(2999.99)).toBe("crystal");
  expect(world.observe(3000)).toBe("lava");
  expect(world.observe(11999.99)).toBe("lava");
  expect(world.observe(12000)).toBe("abyss");
  expect(world.observe(95000)).toBe("abyss");
});
it("does not rewind on bounces or invalid input; a new run starts in the sky", () => {
  const world = new DepthLocations();
  world.observe(520);
  for (const depth of [490, -1, NaN, Infinity]) expect(world.observe(depth)).toBe("crystal");
  world.observe(12000);
  for (const depth of [3900, 3000, 500, 0]) expect(world.observe(depth)).toBe("abyss");
  expect(new DepthLocations().observe(0)).toBe("sky");
});
