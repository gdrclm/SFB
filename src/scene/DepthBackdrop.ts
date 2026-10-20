import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { preloadCrystalBackdrop } from "./createCrystalBackdrop";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import type { Scene } from "@babylonjs/core/scene";
import type { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { DepthLocations, type DepthLocation } from "./DepthLocations";
import { createPhaseOneBackdrop, type WorldAppearance } from "./createPhaseOneBackdrop";

export class DepthBackdrop {
  readonly #scene: Scene;
  readonly #rig: TransformNode;
  readonly #appearance: WorldAppearance;
  readonly #locations = new DepthLocations();
  #location: DepthLocation = "sky";
  #current: Mesh;
  #next: Mesh | null = null;
  #blend = 0;
  readonly #reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  public constructor(scene: Scene, rig: TransformNode, appearance: WorldAppearance) {
    this.#scene = scene; this.#rig = rig; this.#appearance = appearance;
    this.#current = createPhaseOneBackdrop(scene, rig, appearance);
    preloadCrystalBackdrop();
  }
  public update(depth: number, realSeconds: number): void {
    const location = this.#locations.observe(depth);
    if (location !== this.#location) {
      this.#next?.dispose(false, true);
      this.#next = createPhaseOneBackdrop(this.#scene, this.#rig, this.#appearance, location);
      this.#next.position.z = 5.95;
      this.#blend = 0;
      (this.#next.material as StandardMaterial).alpha = 0;
      this.#location = location;
    }
    if (this.#next !== null && (this.#next.material as StandardMaterial).diffuseTexture?.isReady() !== false) {
      this.#blend = this.#reduced ? 1 : Math.min(1, this.#blend + realSeconds / 1.2);
      (this.#next.material as StandardMaterial).alpha = this.#blend;
      if (this.#blend >= 1) {
        this.#current.dispose(false, true);
        this.#current = this.#next; this.#next = null;
        this.#current.position.z = 6;
      }
    }
    const camera = this.#scene.activeCamera;
    if (camera !== null) {
      const width = (camera.orthoRight ?? 14) - (camera.orthoLeft ?? -14);
      const height = (camera.orthoTop ?? 21) - (camera.orthoBottom ?? -21);
      // Fit both axes: a portrait crop must not hide the location's side silhouettes.
      this.#current.scaling.set(width / 28 * 1.04, height / 42 * 1.04, 1);
      this.#next?.scaling.copyFrom(this.#current.scaling);
      this.#fitImage(this.#current, width / height);
      if (this.#next !== null) this.#fitImage(this.#next, width / height);
    }
  }
  #fitImage(mesh: Mesh, viewAspect: number): void {
    const metadata = mesh.metadata as { imageAspect?: number } | null;
    const imageAspect = metadata?.imageAspect;
    const texture = (mesh.material as StandardMaterial).diffuseTexture;
    if (imageAspect === undefined || !(texture instanceof Texture)) return;
    texture.uScale = Math.min(1, viewAspect / imageAspect);
    texture.vScale = Math.min(1, imageAspect / viewAspect);
    texture.uOffset = (1 - texture.uScale) / 2;
    texture.vOffset = (1 - texture.vScale) / 2;
  }
  public dispose(): void { this.#next?.dispose(false, true); this.#current.dispose(false, true); }
}
