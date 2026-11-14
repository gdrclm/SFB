import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import type { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { ballActivity } from "./BallActivity";

const limbs = new WeakMap<Mesh, BallLimbs>();
export function getBallLimbs(ball: Mesh): BallLimbs | undefined { return limbs.get(ball); }
export function createBallLimbs(ball: Mesh, radius: number, blue: StandardMaterial): void {
  limbs.set(ball, new BallLimbs(ball, radius, blue));
}

export class BallLimbs {
  readonly #parts: Mesh[] = [];
  readonly #radius: number;
  readonly #reduced = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  #phase = 0;
  #fold = 0;
  #contact = 0;
  #dead = false;

  public constructor(ball: Mesh, radius: number, blue: StandardMaterial) {
    this.#radius = radius;
    for (const name of ["HandLeft", "HandRight", "FootLeft", "FootRight"]) {
      const part = MeshBuilder.CreateSphere(`Ball${name}`, { diameter: radius * .48, segments: 12 }, ball.getScene());
      part.parent = ball; part.material = blue; part.isPickable = false;
      this.#parts.push(part);
    }
    this.update(0, 10);
  }

  public tuck(defeat = false): void {
    this.#dead ||= defeat;
    this.#contact = .38;
    this.#fold = 1;
    this.update(0, 0);
  }

  public update(seconds: number, speed: number): void {
    const dt = Math.min(.1, Math.max(0, seconds));
    const activity = ballActivity(speed), power = activity.energy;
    this.#phase += dt * Math.PI * 2 * (this.#reduced ? .5 : activity.cadence);
    this.#contact = Math.max(0, this.#contact - dt);
    const target = this.#dead || this.#contact > 0 ? 1 : 0;
    this.#fold += (target - this.#fold) * (1 - Math.exp(-14 * dt));
    const fold = this.#fold, r = this.#radius;
    for (let i = 0; i < this.#parts.length; i++) {
      const part = this.#parts[i]; if (!part) continue;
      const side = i % 2 === 0 ? -1 : 1, hand = i < 2;
      const swing = Math.sin(this.#phase + (i % 2) * Math.PI + (hand ? 0 : Math.PI / 2));
      const motion = (this.#reduced ? .025 : .07 + power * .27) * (1 - fold);
      const diving = activity.mode === "dive", surging = activity.mode === "surge";
      const x = hand ? (diving ? .65 : surging ? .82 : .96) + swing * motion * .55 : .46 + (surging ? swing * .12 : 0);
      const y = (hand ? diving ? .46 : surging ? .24 : -.08 : -.88) + swing * motion;
      part.position.set(side * r * (x * (1 - fold) + (hand ? .25 : .15) * fold), r * (y * (1 - fold) - .94 * fold), r * (-.22 * (1 - fold) + .35 * fold));
      part.rotation.z = side * (hand ? diving ? -.8 : surging ? .55 : -.25 : .18) + swing * motion * 2.8;
      part.scaling.set(1 - fold * .25, (hand ? 1.1 : .85) - fold * .25, hand ? .8 : 1.15);
      part.metadata = { activity: activity.mode };
    }
  }
}
