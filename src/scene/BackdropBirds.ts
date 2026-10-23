import type { Scene } from "@babylonjs/core/scene";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";

interface WingStation { span: number; leading: number; trailing: number; thickness: number }

/** Simple closed wing: its silhouette changes through a full stroke without fine feather detail. */
function createWing(name: string, side: number, scene: Scene, tip = false): Mesh {
  const mesh = new Mesh(name, scene);
  const stations: WingStation[] = tip
    ? [{ span: 0, leading: 0, trailing: -.22, thickness: .025 }, { span: .22, leading: -.03, trailing: -.19, thickness: .018 }, { span: .44, leading: -.15, trailing: -.155, thickness: .004 }]
    : [{ span: 0, leading: .10, trailing: -.14, thickness: .045 }, { span: .17, leading: .04, trailing: -.24, thickness: .04 }, { span: .34, leading: -.05, trailing: -.27, thickness: .025 }];
  const positions: number[] = [], indices: number[] = [];
  stations.forEach(({ span, leading, trailing, thickness }, i) => {
    const camber = Math.sin(i / 2 * Math.PI) * .025;
    for (const [x, y] of [[leading, thickness], [trailing, thickness * .3], [leading, -thickness], [trailing, -thickness * .3]]) {
      positions.push(x ?? 0, (y ?? 0) + camber, side * span);
    }
    if (i > 0) {
      const p = (i - 1) * 4, n = i * 4;
      indices.push(p, n, n + 1, p, n + 1, p + 1, p + 2, p + 3, n + 3, p + 2, n + 3, n + 2,
        p, p + 2, n + 2, p, n + 2, n, p + 1, n + 1, n + 3, p + 1, n + 3, p + 3);
    }
  });
  indices.push(0, 1, 3, 0, 3, 2, 8, 10, 11, 8, 11, 9);
  if (side > 0) for (let i = 0; i < indices.length; i += 3) {
    const n = indices[i + 1] ?? 0; indices[i + 1] = indices[i + 2] ?? 0; indices[i + 2] = n;
  }
  const data = new VertexData(); data.positions = positions; data.indices = indices;
  const normals: number[] = []; VertexData.ComputeNormals(positions, indices, normals); data.normals = normals;
  data.applyToMesh(mesh); mesh.isPickable = false;
  return mesh;
}

function stroke(p: number): number {
  const down = p < .38, progress = down ? p / .38 : (p - .38) / .62;
  const ease = .5 - .5 * Math.cos(progress * Math.PI);
  return down ? -1.02 + ease * 2 : .98 - ease * 2;
}

interface BirdWing { hinge: TransformNode; tip: Mesh; side: number }

/** Camera-relative flock: horizontal travel, with articulated 3D wingbeats and gentle banking. */
export class BackdropBirds {
  readonly #scene: Scene;
  readonly #root: TransformNode;
  readonly #materials: StandardMaterial[] = [];
  readonly #birds: { root: TransformNode; wings: BirdWing[]; opacity: number }[] = [];
  readonly #reduced: boolean;
  #elapsed = 0;

  public constructor(scene: Scene, reduced = false) {
    this.#scene = scene; this.#reduced = reduced;
    this.#root = new TransformNode("BackdropBirds", scene);
    this.#root.parent = scene.activeCamera;
    this.#root.position.z = 4 - (scene.activeCamera?.position.z ?? -10);
    for (let i = 0; i < 3; i++) {
      const material = new StandardMaterial(i === 0 ? "BackdropBirdMaterial" : `BackdropBirdMaterial-${String(i)}`, scene);
      // Aerial perspective: distant silhouettes shift towards the sky and lose contrast.
      material.disableLighting = true;
      material.diffuseColor = Color3.Black();
      material.emissiveColor = Color3.Lerp(new Color3(.12, .25, .35), new Color3(.58, .78, .88), .68 - i * .14);
      material.specularColor = Color3.Black();
      this.#materials.push(material);
      const root = new TransformNode(`BackdropBird-${String(i)}`, scene); root.parent = this.#root;
      const body = MeshBuilder.CreateSphere(`BackdropBirdBody-${String(i)}`, { diameter: 1, segments: 12 }, scene);
      body.parent = root; body.scaling.set(.40, .17, .19); body.material = material; body.isPickable = false;
      const tail = MeshBuilder.CreateCylinder(`BackdropBirdTail-${String(i)}`, { diameterTop: 0, diameterBottom: .24, height: .24, tessellation: 3 }, scene);
      tail.parent = root; tail.position.x = -.26; tail.rotation.z = -Math.PI / 2;
      tail.scaling.z = .3; tail.material = material; tail.isPickable = false;
      const wings: BirdWing[] = [];
      for (const side of [-1, 1]) {
        const hinge = new TransformNode(`BackdropBirdShoulder-${String(i)}-${String(side)}`, scene);
        hinge.parent = root; hinge.position.set(-.03, .025, side * .07);
        const wing = createWing(`BackdropBirdWing-${String(i)}-${String(side)}`, side, scene);
        wing.parent = hinge; wing.material = material;
        const tip = createWing(`BackdropBirdTip-${String(i)}-${String(side)}`, side, scene, true);
        tip.parent = hinge; tip.position.set(-.05, 0, side * .34); tip.material = material;
        wings.push({ hinge, tip, side });
      }
      this.#birds.push({ root, wings, opacity: .55 + i * .075 });
    }
  }

  public update(seconds: number, visibility: number): void {
    this.#elapsed += Math.min(.1, Math.max(0, seconds));
    this.#root.setEnabled(visibility > .001);
    const camera = this.#scene.activeCamera;
    const width = (camera?.orthoRight ?? 14) - (camera?.orthoLeft ?? -14);
    const height = (camera?.orthoTop ?? 21) - (camera?.orthoBottom ?? -21);
    const left = camera?.orthoLeft ?? -14, bottom = camera?.orthoBottom ?? -21;
    const viewportWidth = this.#scene.getEngine().getRenderingCanvas()?.clientWidth || this.#scene.getEngine().getRenderWidth();
    // Keep the entire flock between gameplay and scenery even at extreme camera zoom.
    this.#root.scaling.z = Math.min(1, .7 / Math.max(.7, width * 26 / Math.max(1, viewportWidth)));
    this.#birds.forEach(({ root, wings, opacity }, i) => {
      const material = this.#materials[i]; if (material) material.alpha = visibility * opacity;
      const t = this.#elapsed;
      const progress = (t / (38 + i * 9) + .14 + i * .27) % 1;
      root.position.set(left + width * (-.08 + progress * 1.16), bottom + height * ([.7, .46, .29][i] ?? .5), 0);
      root.scaling.setAll(width * (18 + i * 4) / Math.max(1, viewportWidth));
      root.rotation.set(-.18 + Math.sin(t * .5 + i) * (this.#reduced ? .025 : .08), -.55, 0);
      const beat = t * (this.#reduced ? .85 : 1.65 + i * .13) + i * .31;
      const phase = beat % 1;
      const glide = .5 + .5 * Math.sin(t * .85 + i * 1.9);
      const transition = Math.max(0, Math.min(1, (glide - .78) / .2));
      const amplitude = (1 - transition * transition * (3 - 2 * transition)) * (this.#reduced ? .65 : 1);
      // Fast downstroke, slower recovery; both wings move together around the body axis.
      for (const { hinge, tip, side } of wings) {
        hinge.rotation.x = side * (.08 + stroke(phase) * amplitude);
        tip.rotation.x = side * (.12 + stroke((phase + .88) % 1) * .28 * amplitude);
      }
    });
  }

  public dispose(): void { this.#root.dispose(); for (const material of this.#materials) material.dispose(); }
}
