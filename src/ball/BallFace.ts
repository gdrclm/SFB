import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
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
  readonly #stars: Mesh[] = [];
  readonly #mouths = new Map<string, Mesh>();
  readonly #radius: number;
  #blinkTime = 0;
  #defeatAge = 0;
  readonly #crossEyes: Mesh[] = [];
  readonly #defeatTongue: Mesh;
  public constructor(ball: Mesh, r: number, dark: StandardMaterial, scene: Scene) {
    this.#radius = r;
    const white = new StandardMaterial("BallEyeWhite", scene);
    white.diffuseColor = new Color3(.97, 1, 1); white.emissiveColor = new Color3(.12, .15, .18);
    white.specularColor = new Color3(.5, .6, .7); white.specularPower = 40;
    for (const side of [-1, 1]) {
      const eye = MeshBuilder.CreateSphere(`BallEye${side < 0 ? "Left" : "Right"}`, { diameter: r * .46, segments: 16 }, scene);
      eye.parent = ball; eye.position.set(side * r * .32, r * .04, -r * .96);
      eye.scaling.set(.47, 1.0, .35); eye.material = dark; eye.isPickable = false;
      const pupil = MeshBuilder.CreateSphere(`BallPupil${String(side)}`, { diameter: r * .22, segments: 12 }, scene);
      pupil.parent = eye; pupil.position.set(0, -.01 * r, -r * .22);
      pupil.scaling.set(.92, 1.15, .45); pupil.material = dark; pupil.isPickable = false;
      const shine = MeshBuilder.CreateSphere(`BallEyeGlint${String(side)}`, { diameter: r * .075, segments: 8 }, scene);
      shine.parent = pupil; shine.position.set(-r * .028, r * .045, -r * .095);
      shine.material = white; shine.isPickable = false;
      const brow = MeshBuilder.CreateTube(`BallBrow${String(side)}`, { path: [new Vector3(-r * .16, 0, 0), new Vector3(0, r * .025, -.02 * r), new Vector3(r * .16, 0, 0)], radius: r * .035, tessellation: 6 }, scene);
      brow.parent = ball; brow.position.set(side * r * .32, r * .42, -r * 1.0); brow.material = dark; brow.isPickable = false; brow.visibility = 0;
      for (const axis of [0, 1]) {
        const star = MeshBuilder.CreatePolyhedron(`BallEyeStar${String(side)}-${String(axis)}`, { type: 1, size: r * .09 }, scene);
        star.parent = eye; star.position.z = -r * .30; star.scaling.set(axis === 0 ? .85 : 1.45, axis === 0 ? 1.5 : .35, .13);
        star.material = white; star.isPickable = false; star.setEnabled(false); this.#stars.push(star);
      }
      for (const diagonal of [-1, 1]) {
        const cross = MeshBuilder.CreateTube(`BallDefeatEye-${String(side)}-${String(diagonal)}`, {
          path: [new Vector3(-r * .12, -r * .14 * diagonal, 0), new Vector3(r * .12, r * .14 * diagonal, 0)],
          radius: r * .047, tessellation: 6,
        }, scene);
        cross.parent = ball; cross.position.set(side * r * .32, r * .04, -r * 1.10);
        cross.material = dark; cross.isPickable = false; cross.setEnabled(false); this.#crossEyes.push(cross);
      }
      this.#eyes.push(eye); this.#pupils.push(pupil); this.#brows.push(brow);
    }
    for (const shape of ["smile", "flat", "wince", "frown"]) {
      const path = Array.from({ length: 13 }, (_, i) => {
        const u = (i / 12 - .5) * 2, x = u * r * .24;
        const y = r * (shape === "smile" ? -.23 - .10 * (1 - u * u) : shape === "frown" ? -.43 + .12 * (1 - u * u) : shape === "wince" ? -.34 + Math.sin(u * Math.PI * 3) * .035 : -.34);
        return new Vector3(x, y, -r * 1.025);
      });
      const mouth = MeshBuilder.CreateTube(`BallMouth-${shape}`, { path, radius: r * .035, tessellation: 6 }, scene);
      mouth.parent = ball; mouth.material = dark; mouth.isPickable = false; mouth.setEnabled(false);
      this.#mouths.set(shape, mouth);
    }
    const open = MeshBuilder.CreateSphere("BallMouth-open", { diameter: r * .33, segments: 16 }, scene);
    open.parent = ball; open.position.set(0, -r * .26, -r * 1.02); open.scaling.set(1, 1.3, .3); open.material = dark; open.isPickable = false;
    this.#mouths.set("open", open);
    const defeatMouth = MeshBuilder.CreateSphere("BallMouth-defeat", { diameter: r * .35, segments: 12 }, scene);
    defeatMouth.parent = ball; defeatMouth.position.set(.04 * r, -.28 * r, -r * 1.06);
    defeatMouth.scaling.set(1, .75, .25); defeatMouth.material = dark; defeatMouth.isPickable = false;
    this.#mouths.set("defeat", defeatMouth);
    const pink = new StandardMaterial("BallDefeatTongueMaterial", scene);
    pink.diffuseColor = new Color3(1, .22, .43); pink.emissiveColor = new Color3(.35, .04, .09);
    this.#defeatTongue = MeshBuilder.CreateSphere("BallDefeatTongue", { diameter: r * .27, segments: 16 }, scene);
    this.#defeatTongue.parent = ball; this.#defeatTongue.material = pink; this.#defeatTongue.isPickable = false;
    this.#defeatTongue.position.set(.07 * r, -.43 * r, -r * 1.14); this.#defeatTongue.setEnabled(false);
    const smileShape = Array.from({ length: 13 }, (_, i) => {
      const u = i / 6 - 1;
      return new Vector3(u * r * .24, r * (-.25 + .025 * (1 - u * u)), 0);
    });
    for (let i = 12; i >= 0; i--) {
      const u = i / 6 - 1;
      smileShape.push(new Vector3(u * r * .24, r * (-.25 - .23 * Math.sqrt(Math.max(0, 1 - u * u))), 0));
    }
    const laugh = MeshBuilder.ExtrudeShape("BallMouth-laugh", { shape: smileShape,
      path: [new Vector3(0, 0, -r * 1.025), new Vector3(0, 0, -r * 1.055)], closeShape: true, cap: Mesh.CAP_ALL, sideOrientation: Mesh.DOUBLESIDE }, scene);
    laugh.parent = ball; laugh.material = dark; laugh.isPickable = false;
    const tongueMaterial = new StandardMaterial("BallTongueMaterial", scene);
    tongueMaterial.diffuseColor = new Color3(.03, .22, .75); tongueMaterial.emissiveColor = new Color3(.02, .05, .2);
    const tongue = MeshBuilder.CreateSphere("BallTongue", { diameter: r * .22, segments: 12 }, scene);
    tongue.parent = laugh; tongue.position.set(0, -r * .40, -r * 1.075); tongue.scaling.set(1, .42, .15);
    tongue.material = tongueMaterial; tongue.isPickable = false;
    this.#mouths.set("laugh", laugh);
    this.update("neutral", 0, 0);
  }
  public update(expression: BallExpression, delta: number, look: number, anticipation = false): boolean {
    this.#blinkTime += delta;
    const defeated = expression === "defeat";
    this.#defeatAge = defeated ? this.#defeatAge + delta : 0;
    for (const cross of this.#crossEyes) cross.setEnabled(defeated);
    this.#defeatTongue.setEnabled(defeated);
    if (defeated) {
      const stretch = 1 - Math.exp(-14 * this.#defeatAge);
      this.#defeatTongue.scaling.set(.7, .3 + stretch + Math.sin(this.#defeatAge * 12) * .08, .35);
      this.#defeatTongue.rotation.z = -.22 + Math.sin(this.#defeatAge * 7) * .08;
    }
    const blink = expression === "neutral" && this.#blinkTime % 3.8 > 3.68;
    const hurt = expression === "hurt" || expression === "defeat";
    const focus = expression === "focus" || expression === "boost" || expression === "break";
    const happy = expression === "heal" || expression === "coin" || expression === "break" || expression === "combo";
    const eyeHeight = hurt ? .16 : blink || expression === "slow" || expression === "combo" ? .12 : expression === "danger" ? 1.45 : focus ? .85 : 1.0;
    const amount = 1 - Math.exp(-24 * delta);
    this.#eyes.forEach((eye, index) => {
      eye.setEnabled(!defeated);
      eye.scaling.y += (eyeHeight - eye.scaling.y) * amount;
      const pupil = this.#pupils[index], brow = this.#brows[index];
      if (pupil) { pupil.position.x += (look * this.#radius * .065 - pupil.position.x) * amount; pupil.setEnabled(expression !== "coin" && eyeHeight > .2); }
      if (brow) {
        brow.setEnabled(!defeated);
        brow.visibility += ((focus || hurt || expression === "danger" ? 1 : 0) - brow.visibility) * amount;
        const side = index === 0 ? -1 : 1;
        brow.rotation.z += ((focus ? side * .38 : hurt ? -side * .3 : 0) - brow.rotation.z) * amount;
        brow.position.y += (this.#radius * (happy ? .47 : focus ? .36 : .42) - brow.position.y) * amount;
      }
    });
    for (const star of this.#stars) star.setEnabled(expression === "coin");
    const shape = defeated ? "defeat" : ((expression === "boost" || expression === "break") && anticipation) ? "frown" : hurt ? "wince"
      : expression === "coin" || expression === "combo" ? "laugh"
      : expression === "danger" || expression === "fall" ? "open" : expression === "slow" ? "flat" : "smile";
    for (const [name, mesh] of this.#mouths) mesh.setEnabled(name === shape);
    return blink;
  }
}
