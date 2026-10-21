import { Color3 } from "@babylonjs/core/Maths/math.color";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { Scene } from "@babylonjs/core/scene";
import type { PowerUpController } from "./PowerUpController";
export class PowerVisuals {
  readonly #root: TransformNode;
  readonly #scene: Scene;
  readonly #reduced: boolean;
  readonly #materials: StandardMaterial[] = [];
  readonly #rings;
  readonly #ball: { position: { x: number; y: number; z: number }; rotation: { z: number } };
  readonly #powers: PowerUpController;
  #time = 0;
  public constructor(scene: Scene, ball: { position: { x: number; y: number; z: number }; rotation: { z: number } }, powers: PowerUpController, reduced = false) {
    this.#ball = ball; this.#powers = powers; this.#scene = scene; this.#reduced = reduced;
    this.#root = new TransformNode("PlasmaPowerSphere", scene); this.#root.setEnabled(false);
    const shell = new StandardMaterial("PlasmaShell", scene);
    shell.diffuseColor = new Color3(.05, .4, 1); shell.emissiveColor = new Color3(.18, .2, 1); shell.alpha = .24;
    this.#materials.push(shell);
    const sphere = MeshBuilder.CreateSphere("PlasmaShell", { diameter: 1.6, segments: 12 }, scene);
    sphere.parent = this.#root; sphere.material = shell; sphere.isPickable = false;
    const glow = new StandardMaterial("PlasmaOrbits", scene);
    glow.disableLighting = true; glow.emissiveColor = new Color3(.65, .95, 1); glow.alpha = 1;
    this.#materials.push(glow);
    const rimMaterial = new StandardMaterial("PlasmaSphereRim", scene);
    rimMaterial.disableLighting = true; rimMaterial.emissiveColor = new Color3(.75, .35, 1);
    this.#materials.push(rimMaterial);
    const rim = MeshBuilder.CreateTorus("PlasmaSphereRim", { diameter: 1.85, thickness: .075, tessellation: 32 }, scene);
    rim.parent = this.#root; rim.rotation.x = Math.PI / 2; rim.material = rimMaterial; rim.isPickable = false;
    this.#rings = [0, 1, 2].map(index => {
      const mesh = MeshBuilder.CreateTorus(`PlasmaOrbit${String(index)}`, { diameter: 1.65 + index * .12, thickness: .035, tessellation: 24 }, scene);
      mesh.parent = this.#root; mesh.material = glow; mesh.isPickable = false;
      mesh.rotation.x = Math.PI / 3 * index; mesh.rotation.z = Math.PI / 3 * index;
      return mesh;
    });
  }
  public fixedUpdate(delta: number, realSeconds = delta): void {
    this.#root.setEnabled(this.#powers.invulnerable);
    if (!this.#powers.invulnerable) return;
    this.#time += realSeconds;
    if (!this.#reduced && this.#time < .9) this.#ball.rotation.z = (this.#time * this.#time * 34) % (Math.PI * 2);
    this.#root.position.copyFromFloats(this.#ball.position.x, this.#ball.position.y, this.#ball.position.z);
    const camera = this.#scene.activeCamera;
    const visibleHeight = (camera?.orthoTop ?? 16) - (camera?.orthoBottom ?? -16);
    const canvasHeight = this.#scene.getEngine().getRenderingCanvas()?.getBoundingClientRect().height ?? 844;
    const size = Math.max(1, visibleHeight * 48 / Math.max(1, canvasHeight) / 1.7);
    this.#root.scaling.setAll(size * (1 + (this.#reduced ? 0 : Math.sin(this.#time * 12) * .035)));
    if (this.#reduced) return;
    for (const [index, ring] of this.#rings.entries()) {
      ring.rotation.z += realSeconds * (5 + index * 3);
      ring.rotation.x += realSeconds * (3 + index);
    }
  }
  public dispose(): void { this.#root.dispose(); for (const material of this.#materials) material.dispose(); }
}
