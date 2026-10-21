import { expect, it } from "vitest";
import { CRYSTAL_ATLAS_SIZE, CRYSTAL_SCENERY } from "./CrystalSceneryLayout";

it("packs complete crystal silhouettes without cropping, stretching or overlapping atlas entries", () => {
  const [width, height] = CRYSTAL_ATLAS_SIZE;
  const names = new Set<string>();
  for (const island of CRYSTAL_SCENERY) {
    expect(names.has(island.name)).toBe(false);
    names.add(island.name);
    const [left, top, right, bottom] = island.bounds;
    const [x, y, w, h] = island.atlas;
    expect(w).toBe(right - left);
    expect(h).toBe(bottom - top);
    expect(x).toBeGreaterThanOrEqual(4);
    expect(y).toBeGreaterThanOrEqual(4);
    expect(x + w).toBeLessThanOrEqual(width - 4);
    expect(y + h).toBeLessThanOrEqual(height - 4);
    if (island.edge === "left") expect(left).toBe(0);
    if (island.edge === "right") expect(right).toBe(941);
    for (const other of CRYSTAL_SCENERY) {
      if (island.name === other.name) continue;
      const [ox, oy, ow, oh] = other.atlas;
      expect(x + w <= ox || ox + ow <= x || y + h <= oy || oy + oh <= y).toBe(true);
    }
  }
});
