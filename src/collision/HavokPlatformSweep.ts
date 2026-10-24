import { Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import {
  PhysicsShapeSphere,
  ShapeCastResult,
} from "@babylonjs/core/Physics";
import type { HavokPlugin } from "@babylonjs/core/Physics";
import type { Scene } from "@babylonjs/core/scene";
import type { BallPosition } from "../ball/BallController";
import type { PlatformController } from "../platform/PlatformController";
import type { PlatformSweep } from "./CollisionResolver";

export class HavokPlatformSweep implements PlatformSweep {
  readonly #plugin: HavokPlugin;
  readonly #shape: PhysicsShapeSphere;
  readonly #platformByTransform: Map<unknown, PlatformController>;
  readonly #platforms: readonly PlatformController[];
  #knownCount: number;
  readonly #rotation = Quaternion.Identity();
  readonly #start = Vector3.Zero();
  readonly #end = Vector3.Zero();
  readonly #inputResult = new ShapeCastResult();
  readonly #hitResult = new ShapeCastResult();

  public constructor(
    scene: Scene,
    plugin: HavokPlugin,
    ballRadius: number,
    platforms: readonly PlatformController[],
  ) {
    this.#plugin = plugin;
    this.#platforms = platforms; this.#knownCount = platforms.length;
    this.#shape = new PhysicsShapeSphere(Vector3.Zero(), ballRadius, scene);
    this.#platformByTransform = new Map(
      platforms.map((platform) => [platform.mesh, platform]),
    );
  }

  public get hitFraction(): number { return Math.max(0, Math.min(1, this.#hitResult.hitFraction)); }

  public cast(start: BallPosition, end: BallPosition): PlatformController | null {
    while (this.#knownCount < this.#platforms.length) {
      const platform = this.#platforms[this.#knownCount++];
      if (platform) this.#platformByTransform.set(platform.mesh, platform);
    }
    this.#start.set(start.x, start.y, start.z);
    this.#end.set(end.x, end.y, end.z);
    this.#plugin.shapeCast(
      {
        shape: this.#shape,
        rotation: this.#rotation,
        startPosition: this.#start,
        endPosition: this.#end,
        shouldHitTriggers: false,
      },
      this.#inputResult,
      this.#hitResult,
    );

    const body = this.#hitResult.body;
    return body === undefined
      ? null
      : (this.#platformByTransform.get(body.transformNode) ?? null);
  }

  public dispose(): void {
    this.#shape.dispose();
  }
}
