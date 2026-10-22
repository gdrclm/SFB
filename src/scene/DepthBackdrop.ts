import { preloadCrystalBackdrop } from "./createIllustratedBackdrop";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import type { Scene } from "@babylonjs/core/scene";
import type { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { BackdropScenery } from "./BackdropScenery";
import { advancePageTime, pageProgress } from "./BackdropMotion";
import { DepthLocations, type DepthLocation } from "./DepthLocations";
import { createPhaseOneBackdrop, type WorldAppearance } from "./createPhaseOneBackdrop";

export class DepthBackdrop {
  readonly #scene: Scene;
  readonly #rig: TransformNode;
  readonly #appearance: WorldAppearance;
  readonly #locations = new DepthLocations();
  #location: DepthLocation = "sky";
  #currentLocation: DepthLocation = "sky";
  #current: Mesh;
  #next: Mesh | null = null;
  #elapsed = 0;
  #blend = 0;
  #travel = 0;
  #steeringX = 0;
  #previousCameraY: number;
  readonly #reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  public constructor(scene: Scene, rig: TransformNode, appearance: WorldAppearance, startDepth = 0) {
    this.#scene = scene; this.#rig = rig; this.#appearance = appearance;
    this.#previousCameraY = rig.position.y;
    this.#location = this.#currentLocation = this.#locations.observe(startDepth);
    this.#current = createPhaseOneBackdrop(scene, rig, appearance, this.#location);
    preloadCrystalBackdrop();
  }
  public get crystalBlend(): number {
    if (this.#next === null) return this.#currentLocation === "crystal" ? 1 : 0;
    return (this.#currentLocation === "crystal" ? 1 - this.#blend : 0) + (this.#location === "crystal" ? this.#blend : 0);
  }
  public update(depth: number, realSeconds: number, playerX = 0): void {
    const location = this.#locations.observe(depth);
    // Finish an in-flight page before starting the next, including very fast runs.
    if (location !== this.#location && this.#next === null) {
      this.#next = createPhaseOneBackdrop(this.#scene, this.#rig, this.#appearance, location);
      this.#elapsed = 0; this.#blend = 0; this.#location = location;
      this.#next.setEnabled(false);
    }
    const camera = this.#scene.activeCamera;
    const width = (camera?.orthoRight ?? 14) - (camera?.orthoLeft ?? -14);
    const height = (camera?.orthoTop ?? 21) - (camera?.orthoBottom ?? -21);
    if (realSeconds > 0) {
      this.#travel += (this.#previousCameraY - this.#rig.position.y) * 42 / height;
      this.#steeringX += (playerX - this.#steeringX) * (1 - Math.exp(-5 * realSeconds));
    }
    this.#previousCameraY = this.#rig.position.y;
    const ready = this.#next !== null && this.#isReady(this.#next);
    if (ready && this.#next !== null) {
      this.#next.setEnabled(true);
      this.#elapsed = advancePageTime(this.#elapsed, realSeconds);
      // Sliding between locations is a requested gameplay cue, including reduced-motion mode.
      // That preference still reduces scenery parallax, without skipping the location animation.
      this.#blend = pageProgress(this.#elapsed);
    }
    this.#place(this.#current, width, height, this.#blend * height);
    if (this.#next !== null) this.#place(this.#next, width, height, (this.#blend - 1) * height);
    if (ready && this.#blend >= 1 && this.#next !== null) {
      this.#current.dispose(false, true);
      this.#current = this.#next; this.#next = null;
      this.#currentLocation = this.#location;
      this.#current.position.y = 0; this.#blend = 0;
    }
  }
  #isReady(mesh: Mesh): boolean {
    return (mesh.material as StandardMaterial).diffuseTexture?.isReady() !== false
      && this.#scenery(mesh)?.isReady() !== false;
  }
  #scenery(mesh: Mesh): BackdropScenery | undefined {
    return (mesh.metadata as { scenery?: BackdropScenery } | null)?.scenery;
  }
  #place(mesh: Mesh, width: number, height: number, offset: number): void {
    mesh.scaling.set(width / 28, height / 42, 1);
    mesh.position.y = offset;
    this.#scenery(mesh)?.update(this.#travel, this.#steeringX, this.#rig.position.y + offset, height, this.#reduced);
  }
  public dispose(): void { this.#next?.dispose(false, true); this.#current.dispose(false, true); }
}
