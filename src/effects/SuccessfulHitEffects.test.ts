import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Scene } from "@babylonjs/core/scene";
import { describe, expect, it, vi } from "vitest";
import { gameConfig } from "../config/gameConfig";
import { SuccessfulHitEffects } from "./SuccessfulHitEffects";
import { WATER_SPLASH_SECONDS } from "../platform/WaterSplashGeometry";

describe("SuccessfulHitEffects", () => {
  it("starts platform, ball and camera reactions", () => {
    const engine = new NullEngine();
    const scene = new Scene(engine);
    const camera = new FreeCamera("camera", new Vector3(0, 0, -10), scene);
    const ball = MeshBuilder.CreateSphere("ball", { diameter: 1 }, scene);
    const platformMesh = MeshBuilder.CreateBox("platform", { width: 4 }, scene);
    const platform = {
      id: "platform",
      renderBreak: vi.fn(),
      mesh: platformMesh,
      size: { width: 4, height: 0.4, depth: 1 },
    };
    const effects = new SuccessfulHitEffects(ball, camera, gameConfig);
    const meshCountBeforeBreak = scene.meshes.length;
    const completePlatformBreak = vi.fn();
    const initialCameraPosition = camera.position.clone();

    effects.playPlatformBreak(platform, completePlatformBreak);
    effects.playBallReaction();
    effects.playCameraReaction();

    expect(scene.meshes.length).toBe(meshCountBeforeBreak);
    expect(platform.renderBreak).toHaveBeenLastCalledWith(0);
    expect(completePlatformBreak).not.toHaveBeenCalled();

    effects.fixedUpdate(0.05);

    expect(platformMesh.scaling.asArray()).toEqual([1, 1, 1]);
    expect(platform.renderBreak).toHaveBeenLastCalledWith(.05 / gameConfig.successfulHit.platformEffectSeconds);
    expect(ball.scaling.y).toBeGreaterThan(1);
    expect(camera.position.y).not.toBe(initialCameraPosition.y);

    effects.fixedUpdate(gameConfig.successfulHit.platformEffectSeconds);

    expect(completePlatformBreak).toHaveBeenCalledOnce();
    expect(platform.renderBreak).toHaveBeenLastCalledWith(1);
    expect(platformMesh.scaling.asArray()).toEqual([1, 1, 1]);
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

it("lets water finish its arc before returning the already-broken platform to the pool",()=>{
 const engine=new NullEngine(),scene=new Scene(engine),camera=new FreeCamera("camera",new Vector3(0,0,-10),scene);
 const ball=MeshBuilder.CreateSphere("ball",{diameter:1},scene);
 const platform={renderBreak:vi.fn(),breakEffectSeconds:WATER_SPLASH_SECONDS},complete=vi.fn();
 const effects=new SuccessfulHitEffects(ball,camera,gameConfig);
 effects.playPlatformBreak(platform,complete);effects.fixedUpdate(.6);
 expect(complete).not.toHaveBeenCalled();expect(platform.renderBreak).toHaveBeenLastCalledWith(.6/WATER_SPLASH_SECONDS);
 effects.fixedUpdate(.4);expect(complete).not.toHaveBeenCalled();
 effects.fixedUpdate(WATER_SPLASH_SECONDS-1+.01);expect(complete).toHaveBeenCalledOnce();expect(platform.renderBreak).toHaveBeenLastCalledWith(1);
 effects.dispose();scene.dispose();engine.dispose();
});
