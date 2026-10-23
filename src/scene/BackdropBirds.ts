import type { Scene } from "@babylonjs/core/scene";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";

/** Filled, edged wings stay readable when the mobile render buffer is downscaled. */
function createWing(name: string, side: number, scene: Scene): Mesh {
  const mesh = new Mesh(name, scene);
  const positions: number[] = [], indices: number[] = [], colors: number[] = [];
  const path = [[0, 0, .065], [.18, .17, .095], [.37, .25, .075], [.64, .1, .012]];
  path.forEach(([x = 0, y = 0, width = 0], i) => {
    for (const offset of [-1, -.6, .6, 1]) {
      positions.push(side * x, y + offset * width, 0);
      colors.push(...(Math.abs(offset) === 1 ? [.10, .43, .70, 1] : [1, 1, 1, 1]));
    }
    if (i > 0) for (let j = 0; j < 3; j++) {
      const n = i * 4 + j; indices.push(n - 4, n, n + 1, n - 4, n + 1, n - 3);
    }
  });
  const data = new VertexData();
  data.positions = positions; data.indices = indices; data.colors = colors;
  const normals: number[] = []; VertexData.ComputeNormals(positions, indices, normals); data.normals = normals;
  data.applyToMesh(mesh); mesh.isPickable = false;
  return mesh;
}

/** Camera-relative flock: only horizontal travel; falling scenery never changes its altitude. */
export class BackdropBirds {
  readonly #scene: Scene;
  readonly #root: TransformNode;
  readonly #material: StandardMaterial;
  readonly #beakMaterial: StandardMaterial;
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
    this.#material.emissiveColor = Color3.White();
    this.#material.backFaceCulling = false;
    this.#material.disableDepthWrite = true;
    this.#material.diffuseColor = Color3.Black();
    this.#beakMaterial = new StandardMaterial("BackdropBirdBeakMaterial", scene);
    this.#beakMaterial.disableLighting = true;
    this.#beakMaterial.emissiveColor = new Color3(1, .65, .12);
    this.#beakMaterial.diffuseColor = Color3.Black();
    this.#beakMaterial.disableDepthWrite = true;
    for (let i = 0; i < 3; i++) {
      const root = new TransformNode(`BackdropBird-${String(i)}`, scene); root.parent = this.#root;
      const body = MeshBuilder.CreateSphere(`BackdropBirdBody-${String(i)}`, { diameter: .15, segments: 8 }, scene);
      body.parent = root; body.scaling.set(2.1, .85, .8); body.material = this.#material; body.isPickable = false;
      const head = MeshBuilder.CreateSphere(`BackdropBirdHead-${String(i)}`, { diameter: .17, segments: 8 }, scene);
      head.parent = root; head.position.set(.17, .07, -.03); head.material = this.#material; head.isPickable = false;
      const beak = MeshBuilder.CreateCylinder(`BackdropBirdBeak-${String(i)}`, { diameterTop: 0, diameterBottom: .08, height: .18, tessellation: 6 }, scene);
      beak.parent = root; beak.position.set(.32, .07, -.03); beak.rotation.z = -Math.PI / 2;
      beak.material = this.#beakMaterial; beak.isPickable = false;
      const wings: Mesh[] = [];
      for (const side of [-1, 1]) {
        const wing = createWing(`BackdropBirdWing-${String(i)}-${String(side)}`, side, scene);
        wing.parent = root; wing.material = this.#material; wings.push(wing);
      }
      this.#birds.push({ root, wings });
    }
  }

  public update(seconds: number, visibility: number): void {
    this.#elapsed += Math.min(.1, Math.max(0, seconds));
    this.#root.setEnabled(visibility > .001);
    this.#material.alpha = visibility;
    this.#beakMaterial.alpha = visibility;
    const camera = this.#scene.activeCamera;
    const width = (camera?.orthoRight ?? 14) - (camera?.orthoLeft ?? -14);
    const height = (camera?.orthoTop ?? 21) - (camera?.orthoBottom ?? -21);
    const left = camera?.orthoLeft ?? -14, bottom = camera?.orthoBottom ?? -21;
    const viewportWidth = this.#scene.getEngine().getRenderingCanvas()?.clientWidth || this.#scene.getEngine().getRenderWidth();
    this.#birds.forEach(({ root, wings }, i) => {
      const progress = (this.#elapsed / (38 + i * 9) + .14 + i * .27) % 1;
      root.position.set(left + width * (-.08 + progress * 1.16), bottom + height * ([.7, .46, .29][i] ?? .5), 0);
      root.scaling.setAll(width * (28 + i * 6) / Math.max(1, viewportWidth));
      for (let j = 0; j < wings.length; j++) {
        const wing = wings[j]; if (wing) wing.rotation.z = this.#reduced ? 0 : Math.sin(this.#elapsed * 3.2 + i) * .22 * (j === 0 ? -1 : 1);
      }
    });
  }

  public dispose(): void { this.#root.dispose(); this.#material.dispose(); this.#beakMaterial.dispose(); }
}
