import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Scene } from "@babylonjs/core/scene";
import { describe, expect, it } from "vitest";
import { gameConfig } from "../config/gameConfig";
import type { PlatformController } from "../platform/PlatformController";
import { UnsuccessfulHitEffects } from "./UnsuccessfulHitEffects";

describe("UnsuccessfulHitEffects", () => {
  it("shows and then resets the ball, platform and camera error reaction", () => {
    const engine = new NullEngine();
    const scene = new Scene(engine);
    const camera = new FreeCamera("camera", new Vector3(0, 0, -10), scene);
    const ball = MeshBuilder.CreateSphere("ball", { diameter: 1 }, scene);
    const platformMesh = MeshBuilder.CreateBox("platform", { width: 4 }, scene);
    const platform = { mesh: platformMesh } as PlatformController;
    const effects = new UnsuccessfulHitEffects(ball, camera, gameConfig);
    const cameraStart = camera.position.clone();

    effects.playErrorReaction(platform);
    effects.fixedUpdate(0.05);

    expect(ball.scaling.y).toBeLessThan(1);
    expect(platformMesh.visibility).toBeLessThan(1);
    expect(camera.position.x).not.toBe(cameraStart.x);

    effects.fixedUpdate(gameConfig.unsuccessfulHit.feedbackSeconds);

    expect(ball.scaling).toEqual(Vector3.One());
    expect(platformMesh.visibility).toBe(1);
    expect(camera.position).toEqual(cameraStart);

    effects.dispose();
    scene.dispose();
    engine.dispose();
  });
});
