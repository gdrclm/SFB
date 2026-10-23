import type { Scene } from "@babylonjs/core/scene";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";

interface WingStation { span: number; leading: number; trailing: number; thickness: number }

/** Closed, cambered wing with an actual underside, rounded shoulder and tapered dark tip. */
function createWing(name: string, side: number, scene: Scene, tip = false): Mesh {
  const mesh = new Mesh(name, scene);
  const stations: WingStation[] = tip
    ? [{ span: 0, leading: 0, trailing: -.22, thickness: .025 }, { span: .22, leading: -.03, trailing: -.19, thickness: .018 }, { span: .44, leading: -.15, trailing: -.155, thickness: .004 }]
    : [{ span: 0, leading: .10, trailing: -.14, thickness: .045 }, { span: .17, leading: .04, trailing: -.24, thickness: .04 }, { span: .34, leading: -.05, trailing: -.27, thickness: .025 }];
  const positions: number[] = [], indices: number[] = [], colors: number[] = [];
  stations.forEach(({ span, leading, trailing, thickness }, i) => {
    const camber = Math.sin(i / 2 * Math.PI) * .025;
    for (const [x, y] of [[leading, thickness], [trailing, thickness * .3], [leading, -thickness], [trailing, -thickness * .3]]) {
      positions.push(x ?? 0, (y ?? 0) + camber, side * span);
      const dark = tip ? i / 2 : 0;
      colors.push(1 - dark * .77, 1 - dark * .69, 1 - dark * .59, 1);
    }
    if (i > 0) {
      const p = (i - 1) * 4, n = i * 4;
      indices.push(p, n, n + 1, p, n + 1, p + 1, p + 2, p + 3, n + 3, p + 2, n + 3, n + 2,
        p, p + 2, n + 2, p, n + 2, n, p + 1, n + 1, n + 3, p + 1, n + 3, p + 3);
    }
  });
  indices.push(0, 1, 3, 0, 3, 2, 8, 10, 11, 8, 11, 9);
  const data = new VertexData(); data.positions = positions; data.indices = indices; data.colors = colors;
  const normals: number[] = []; VertexData.ComputeNormals(positions, indices, normals); data.normals = normals;
  data.applyToMesh(mesh); mesh.isPickable = false;
  return mesh;
}

interface BirdWing { hinge: TransformNode; tip: Mesh; side: number }

/** Camera-relative flock: horizontal travel, with articulated 3D wingbeats and gentle banking. */
export class BackdropBirds {
  readonly #scene: Scene;
  readonly #root: TransformNode;
  readonly #material: StandardMaterial;
  readonly #beakMaterial: StandardMaterial;
  readonly #birds: { root: TransformNode; wings: BirdWing[] }[] = [];
  readonly #reduced: boolean;
  #elapsed = 0;

  public constructor(scene: Scene, reduced = false) {
    this.#scene = scene; this.#reduced = reduced;
    this.#root = new TransformNode("BackdropBirds", scene);
    this.#root.parent = scene.activeCamera;
    this.#root.position.z = 4 - (scene.activeCamera?.position.z ?? -10);
    this.#material = new StandardMaterial("BackdropBirdMaterial", scene);
    this.#material.diffuseColor = new Color3(.84, .9, .97);
    this.#material.emissiveColor = new Color3(.10, .14, .20);
    this.#material.specularColor = new Color3(.18, .22, .28);
    this.#material.specularPower = 24;
    this.#material.backFaceCulling = false;
    this.#material.twoSidedLighting = true;
    this.#beakMaterial = new StandardMaterial("BackdropBirdBeakMaterial", scene);
    this.#beakMaterial.diffuseColor = new Color3(1, .65, .12);
    this.#beakMaterial.emissiveColor = new Color3(.2, .08, .01);
    for (let i = 0; i < 3; i++) {
      const root = new TransformNode(`BackdropBird-${String(i)}`, scene); root.parent = this.#root;
      const body = MeshBuilder.CreateSphere(`BackdropBirdBody-${String(i)}`, { diameter: 1, segments: 12 }, scene);
      body.parent = root; body.scaling.set(.40, .17, .19); body.material = this.#material; body.isPickable = false;
      const head = MeshBuilder.CreateSphere(`BackdropBirdHead-${String(i)}`, { diameter: .17, segments: 10 }, scene);
      head.parent = root; head.position.set(.18, .07, 0); head.material = this.#material; head.isPickable = false;
      const beak = MeshBuilder.CreateCylinder(`BackdropBirdBeak-${String(i)}`, { diameterTop: 0, diameterBottom: .07, height: .16, tessellation: 6 }, scene);
      beak.parent = root; beak.position.set(.32, .065, 0); beak.rotation.z = -Math.PI / 2;
      beak.material = this.#beakMaterial; beak.isPickable = false;
      const tail = MeshBuilder.CreateCylinder(`BackdropBirdTail-${String(i)}`, { diameterTop: 0, diameterBottom: .24, height: .24, tessellation: 3 }, scene);
      tail.parent = root; tail.position.x = -.26; tail.rotation.z = -Math.PI / 2;
      tail.scaling.z = .3; tail.material = this.#material; tail.isPickable = false;
      const wings: BirdWing[] = [];
      for (const side of [-1, 1]) {
        const hinge = new TransformNode(`BackdropBirdShoulder-${String(i)}-${String(side)}`, scene);
        hinge.parent = root; hinge.position.set(-.03, .025, side * .07);
        const wing = createWing(`BackdropBirdWing-${String(i)}-${String(side)}`, side, scene);
        wing.parent = hinge; wing.material = this.#material;
        const tip = createWing(`BackdropBirdTip-${String(i)}-${String(side)}`, side, scene, true);
        tip.parent = hinge; tip.position.set(-.05, 0, side * .34); tip.material = this.#material;
        wings.push({ hinge, tip, side });
      }
      this.#birds.push({ root, wings });
    }
  }

  public update(seconds: number, visibility: number): void {
    this.#elapsed += Math.min(.1, Math.max(0, seconds));
    this.#root.setEnabled(visibility > .001);
    this.#material.alpha = visibility; this.#beakMaterial.alpha = visibility;
    const camera = this.#scene.activeCamera;
    const width = (camera?.orthoRight ?? 14) - (camera?.orthoLeft ?? -14);
    const height = (camera?.orthoTop ?? 21) - (camera?.orthoBottom ?? -21);
    const left = camera?.orthoLeft ?? -14, bottom = camera?.orthoBottom ?? -21;
    const viewportWidth = this.#scene.getEngine().getRenderingCanvas()?.clientWidth || this.#scene.getEngine().getRenderWidth();
    // Keep the entire flock between gameplay and scenery even at extreme camera zoom.
    this.#root.scaling.z = Math.min(1, .7 / Math.max(.7, width * 40 / Math.max(1, viewportWidth)));
    this.#birds.forEach(({ root, wings }, i) => {
      const t = this.#elapsed;
      const progress = (t / (38 + i * 9) + .14 + i * .27) % 1;
      root.position.set(left + width * (-.08 + progress * 1.16), bottom + height * ([.7, .46, .29][i] ?? .5), 0);
      root.scaling.setAll(width * (28 + i * 6) / Math.max(1, viewportWidth));
      root.rotation.set(this.#reduced ? -.18 : -.18 + Math.sin(t * .7 + i) * .24,
        -.55 + (this.#reduced ? 0 : Math.sin(t * .43 + i * 2) * .16), this.#reduced ? 0 : Math.sin(t * .6 + i) * .045);
      const phase = t * Math.PI * 2 * (1.35 + i * .12) + i * 1.9;
      // Short glides interrupt the wingbeat; each bird has its own phase.
      const glide = this.#reduced ? 0 : .5 + .5 * Math.sin(t * .65 + i * 2);
      const amplitude = this.#reduced ? 0 : .2 + .8 * Math.min(1, glide * 2);
      for (const { hinge, tip, side } of wings) {
        hinge.rotation.x = side * (.08 + Math.sin(phase) * .95 * amplitude);
        tip.rotation.x = side * (.12 + Math.sin(phase - .65) * .32 * amplitude);
      }
    });
  }

  public dispose(): void { this.#root.dispose(); this.#material.dispose(); this.#beakMaterial.dispose(); }
}
