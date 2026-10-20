import type { Scene } from "@babylonjs/core/scene";

/** Retain the backdrop, camera and physics world; release resources owned by a run. */
export class RunSceneResources {
  readonly #scene: Scene;
  readonly #meshes;
  readonly #materials;
  readonly #textures;
  readonly #nodes;
  public constructor(scene: Scene) {
    this.#scene = scene;
    this.#meshes = new Set(scene.meshes);
    this.#materials = new Set(scene.materials);
    this.#textures = new Set(scene.textures);
    this.#nodes = new Set(scene.transformNodes);
  }
  public clear(): void {
    for (const mesh of [...this.#scene.meshes]) if (!this.#meshes.has(mesh)) mesh.dispose();
    for (const node of [...this.#scene.transformNodes]) if (!this.#nodes.has(node)) node.dispose();
    for (const material of [...this.#scene.materials]) if (!this.#materials.has(material)) material.dispose();
    for (const texture of [...this.#scene.textures]) if (!this.#textures.has(texture)) texture.dispose();
  }
}
