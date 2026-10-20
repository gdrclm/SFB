export const LOCATION_DISTANCE = 500;
export type DepthLocation = "sky" | "crystal" | "lava" | "abyss";
const locations: readonly DepthLocation[] = ["sky", "crystal", "lava", "abyss"];

/** Maximum depth makes a bounce unable to rewind the environment. */
export class DepthLocations {
  #depth = 0;
  public observe(depth: number): DepthLocation {
    if (Number.isFinite(depth)) this.#depth = Math.max(this.#depth, depth);
    return locations[Math.floor(this.#depth / LOCATION_DISTANCE) % locations.length] ?? "sky";
  }
}
