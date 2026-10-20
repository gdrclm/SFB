import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Scene } from "@babylonjs/core/scene";
import { describe, expect, it, vi } from "vitest";
import { gameConfig } from "../config/gameConfig";
import type { PlatformController } from "../platform/PlatformController";
import { SuccessfulHitEffects } from "./SuccessfulHitEffects";

describe("SuccessfulHitEffects", () => {
  it("starts platform, ball and camera reactions", () => {
    const engine = new NullEngine();
    const scene = new Scene(engine);
    const camera = new FreeCamera("camera", new Vector3(0, 0, -10), scene);
    const ball = MeshBuilder.CreateSphere("ball", { diameter: 1 }, scene);
    const platformMesh = MeshBuilder.CreateBox("platform", { width: 4 }, scene);
    const platform = {
      id: "platform",
      createBreakFragment: (index: number, width: number) => MeshBuilder.CreatePlane(`platform-fragment-${String(index)}`, { width, height: .4 }, scene),
      mesh: platformMesh,
      size: { width: 4, height: 0.4, depth: 1 },
    } as PlatformController;
    const effects = new SuccessfulHitEffects(ball, camera, gameConfig);
    const meshCountBeforeBreak = scene.meshes.length;
    const completePlatformBreak = vi.fn();
    const initialCameraPosition = camera.position.clone();

    effects.playPlatformBreak(platform, completePlatformBreak);
    effects.playBallReaction();
    effects.playCameraReaction();

    const platformFragments = scene.meshes.filter((mesh) =>
      mesh.name.startsWith("platform-fragment-"),
    );
    expect(platformFragments).toHaveLength(4);
    expect(scene.meshes.length).toBe(meshCountBeforeBreak + 4);
    expect(completePlatformBreak).not.toHaveBeenCalled();
    expect(platformFragments[0]?.position.x).toBeLessThan(platformMesh.position.x);
    expect(platformFragments.at(-1)?.position.x).toBeGreaterThan(platformMesh.position.x);
    const firstFragmentStartX = platformFragments[0]?.position.x;

    effects.fixedUpdate(0.05);

    expect(platformMesh.scaling.y).toBeLessThan(1);
    expect(platformFragments[0]?.position.x).not.toBe(firstFragmentStartX);
    expect(ball.scaling.y).toBeGreaterThan(1);
    expect(camera.position.y).not.toBe(initialCameraPosition.y);

    effects.fixedUpdate(gameConfig.successfulHit.platformEffectSeconds);

    expect(completePlatformBreak).toHaveBeenCalledOnce();
    expect(platformMesh.scaling).toEqual(Vector3.One());
    expect(platformMesh.visibility).toBe(1);
    expect(scene.meshes.length).toBe(meshCountBeforeBreak);

    // A rapid series must return to the original camera position, not accumulate drift.
    for (let hit = 0; hit < 5; hit++) {
      effects.playCameraReaction(1.6);
      effects.fixedUpdate(.03);
    }
    effects.fixedUpdate(gameConfig.successfulHit.cameraEffectSeconds);
    expect(camera.position).toEqual(initialCameraPosition);

    effects.dispose();
    expect(scene.meshes.length).toBe(meshCountBeforeBreak);
    scene.dispose();
    engine.dispose();
  });
});
