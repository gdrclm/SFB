import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import type { Scene } from "@babylonjs/core/scene";
import type { BallExpression } from "./BallExpression";

const faces = new WeakMap<Mesh, BallFace>();
export function getBallFace(ball: Mesh): BallFace | undefined { return faces.get(ball); }
export function createBallFace(ball: Mesh, radius: number, dark: StandardMaterial, scene: Scene): void {
  faces.set(ball, new BallFace(ball, radius, dark, scene));
}

class BallFace {
  readonly #eyes: Mesh[] = [];
  readonly #pupils: Mesh[] = [];
  readonly #brows: Mesh[] = [];
  readonly #mouths = new Map<string, Mesh>();
  readonly #radius: number;
  #blinkTime = 0;
  public constructor(ball: Mesh, r: number, dark: StandardMaterial, scene: Scene) {
    this.#radius = r;
    const white = new StandardMaterial("BallEyeWhite", scene);
    white.diffuseColor = new Color3(.97, 1, 1); white.emissiveColor = new Color3(.12, .15, .18);
    white.specularColor = new Color3(.5, .6, .7); white.specularPower = 40;
    for (const side of [-1, 1]) {
      const eye = MeshBuilder.CreateSphere(`BallEye${side < 0 ? "Left" : "Right"}`, { diameter: r * .46, segments: 16 }, scene);
      eye.parent = ball; eye.position.set(side * r * .32, r * .08, -r * .91);
      eye.scaling.set(.92, 1.2, .72); eye.material = white; eye.isPickable = false;
      const pupil = MeshBuilder.CreateSphere(`BallPupil${String(side)}`, { diameter: r * .22, segments: 12 }, scene);
      pupil.parent = eye; pupil.position.set(0, -.01 * r, -r * .22);
      pupil.scaling.set(.92, 1.15, .45); pupil.material = dark; pupil.isPickable = false;
      const shine = MeshBuilder.CreateSphere(`BallEyeGlint${String(side)}`, { diameter: r * .075, segments: 8 }, scene);
      shine.parent = pupil; shine.position.set(-r * .028, r * .045, -r * .095);
      shine.material = white; shine.isPickable = false;
      const brow = MeshBuilder.CreateTube(`BallBrow${String(side)}`, { path: [new Vector3(-r * .16, 0, 0), new Vector3(0, r * .025, -.02 * r), new Vector3(r * .16, 0, 0)], radius: r * .035, tessellation: 6 }, scene);
      brow.parent = ball; brow.position.set(side * r * .32, r * .42, -r * 1.0); brow.material = dark; brow.isPickable = false;
      this.#eyes.push(eye); this.#pupils.push(pupil); this.#brows.push(brow);
    }
    for (const shape of ["smile", "flat", "wince", "frown"]) {
      const path = Array.from({ length: 13 }, (_, i) => {
        const u = (i / 12 - .5) * 2, x = u * r * .24;
        const y = r * (shape === "smile" ? -.29 - .12 * (1 - u * u) : shape === "frown" ? -.43 + .12 * (1 - u * u) : shape === "wince" ? -.34 + Math.sin(u * Math.PI * 3) * .035 : -.34);
        return new Vector3(x, y, -r * 1.025);
      });
      const mouth = MeshBuilder.CreateTube(`BallMouth-${shape}`, { path, radius: r * .035, tessellation: 6 }, scene);
      mouth.parent = ball; mouth.material = dark; mouth.isPickable = false; mouth.setEnabled(false);
      this.#mouths.set(shape, mouth);
    }
    const open = MeshBuilder.CreateSphere("BallMouth-open", { diameter: r * .26, segments: 16 }, scene);
    open.parent = ball; open.position.set(0, -r * .33, -r * .965); open.scaling.set(1, 1.3, .3); open.material = dark; open.isPickable = false;
    this.#mouths.set("open", open);
    this.update("neutral", 0, 0);
  }
  public update(expression: BallExpression, delta: number, look: number): void {
    this.#blinkTime += delta;
    const blink = expression === "neutral" && this.#blinkTime % 3.8 > 3.68;
    const hurt = expression === "hurt" || expression === "defeat";
    const focus = expression === "focus" || expression === "boost";
    const happy = expression === "heal" || expression === "coin" || expression === "break";
    const eyeHeight = hurt ? .2 : blink ? .12 : focus ? .78 : expression === "slow" ? 1.5 : 1.2;
    const amount = 1 - Math.exp(-24 * delta);
    this.#eyes.forEach((eye, index) => {
      eye.scaling.y += (eyeHeight - eye.scaling.y) * amount;
      const pupil = this.#pupils[index], brow = this.#brows[index];
      if (pupil) pupil.position.x += (look * this.#radius * .065 - pupil.position.x) * amount;
      if (brow) {
        const side = index === 0 ? -1 : 1;
        brow.rotation.z += ((focus ? side * .38 : hurt ? -side * .3 : 0) - brow.rotation.z) * amount;
        brow.position.y += (this.#radius * (happy ? .47 : focus ? .36 : .42) - brow.position.y) * amount;
      }
    });
    const shape = expression === "defeat" ? "frown" : hurt ? "wince" : expression === "slow" || expression === "coin" ? "open" : focus ? "flat" : "smile";
    for (const [name, mesh] of this.#mouths) mesh.setEnabled(name === shape);
  }
}
