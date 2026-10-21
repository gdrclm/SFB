export type DepthLocation = "sky" | "crystal" | "lava" | "abyss";
const locations: readonly { depth: number; location: DepthLocation }[] = [
  { depth: 4000, location: "abyss" },
  { depth: 1500, location: "lava" },
  { depth: 500, location: "crystal" },
];

/** Maximum depth makes a bounce unable to rewind the environment. */
export class DepthLocations {
  #depth = 0;
  public observe(depth: number): DepthLocation {
    if (Number.isFinite(depth)) this.#depth = Math.max(this.#depth, depth);
    return locations.find(location => this.#depth >= location.depth)?.location ?? "sky";
  }
}
