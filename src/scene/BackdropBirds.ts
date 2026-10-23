import type { Scene } from "@babylonjs/core/scene";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";

/** Camera-relative flock: only horizontal travel; falling scenery never changes its altitude. */
export class BackdropBirds {
  readonly #scene: Scene;
  readonly #root: TransformNode;
  readonly #material: StandardMaterial;
  readonly #birds: { root: TransformNode; wings: Mesh[] }[] = [];
  readonly #reduced: boolean;
  #elapsed = 0;

  public constructor(scene: Scene, reduced = false) {
    this.#scene = scene; this.#reduced = reduced;
    this.#root = new TransformNode("BackdropBirds", scene);
    this.#root.parent = scene.activeCamera;
    // Behind the playfield (z=0), in front of the illustrated backdrop (z=6).
    this.#root.position.z = 4 - (scene.activeCamera?.position.z ?? -10);
    this.#material = new StandardMaterial("BackdropBirdMaterial", scene);
    this.#material.disableLighting = true;
    this.#material.emissiveColor = new Color3(.83, .95, 1);
    this.#material.diffuseColor = Color3.Black();
    for (let i = 0; i < 4; i++) {
      const root = new TransformNode(`BackdropBird-${String(i)}`, scene); root.parent = this.#root;
      const body = MeshBuilder.CreateSphere(`BackdropBirdBody-${String(i)}`, { diameter: .15, segments: 8 }, scene);
      body.parent = root; body.scaling.set(1.8, .6, .6); body.material = this.#material; body.isPickable = false;
      const wings: Mesh[] = [];
      for (const side of [-1, 1]) {
        const path = [new Vector3(0, 0, 0), new Vector3(side * .18, .18, 0), new Vector3(side * .36, .25, 0), new Vector3(side * .55, .13, 0)];
        const wing = MeshBuilder.CreateTube(`BackdropBirdWing-${String(i)}-${String(side)}`, { path, radius: .07, tessellation: 6 }, scene);
        wing.parent = root; wing.material = this.#material; wing.isPickable = false; wings.push(wing);
      }
      this.#birds.push({ root, wings });
    }
  }

  public update(seconds: number, visibility: number): void {
    this.#elapsed += Math.min(.1, Math.max(0, seconds));
    this.#root.setEnabled(visibility > .001);
    this.#material.alpha = visibility * .7;
    const camera = this.#scene.activeCamera;
    const width = (camera?.orthoRight ?? 14) - (camera?.orthoLeft ?? -14);
    const height = (camera?.orthoTop ?? 21) - (camera?.orthoBottom ?? -21);
    const left = camera?.orthoLeft ?? -14, bottom = camera?.orthoBottom ?? -21;
    this.#birds.forEach(({ root, wings }, i) => {
      const progress = (this.#elapsed / (38 + i * 9) + i * .29) % 1;
      root.position.set(left + width * (-.08 + progress * 1.16), bottom + height * ([.7, .42, .58, .28][i] ?? .5), 0);
      root.scaling.setAll(width * (.038 + i * .004));
      for (let j = 0; j < wings.length; j++) {
        const wing = wings[j]; if (wing) wing.rotation.z = this.#reduced ? 0 : Math.sin(this.#elapsed * 3.2 + i) * .22 * (j === 0 ? -1 : 1);
      }
    });
  }

  public dispose(): void { this.#root.dispose(); this.#material.dispose(); }
}
