import { Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import type { AbstractEngine } from "@babylonjs/core/Engines/abstractEngine";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { HavokPlugin } from "@babylonjs/core/Physics";
import { Scene } from "@babylonjs/core/scene";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import HavokPhysics from "@babylonjs/havok";
import havokWasmUrl from "@babylonjs/havok/lib/esm/HavokPhysics.wasm?url";
import type { GameConfig } from "../config/gameConfig";
import { createPhaseOneBackdrop, type WorldAppearance } from "./createPhaseOneBackdrop";

export interface MainScene {
  readonly scene: Scene;
  readonly camera: FreeCamera;
  readonly cameraRig: TransformNode;
  readonly physicsPlugin: HavokPlugin;
  readonly getAspectRatio: () => number;
}

export async function createMainScene(
  engine: AbstractEngine,
  config: GameConfig,
  appearance: WorldAppearance = {},
): Promise<MainScene> {
  const scene = new Scene(engine);
  scene.clearColor = appearance.theme === "world-night" ? new Color4(0.02, 0.04, 0.16, 1)
    : appearance.theme === "world-sunset" ? new Color4(0.2, 0.12, 0.36, 1)
      : new Color4(0.03, 0.55, 0.91, 1);

  const cameraRig = new TransformNode("CameraFollowRig", scene);
  const camera = new FreeCamera(
    "SideViewCamera",
    new Vector3(0, 0, -config.camera.distance),
    scene,
  );
  camera.parent = cameraRig;
  camera.mode = FreeCamera.ORTHOGRAPHIC_CAMERA;
  camera.setTarget(Vector3.Zero());
  createPhaseOneBackdrop(scene, cameraRig, appearance);

  const getAspectRatio = (): number => {
    const renderingCanvas = engine.getRenderingCanvas();
    if (renderingCanvas !== null) {
      const bounds = renderingCanvas.getBoundingClientRect();
      if (bounds.width > 0 && bounds.height > 0) {
        return bounds.width / bounds.height;
      }
    }

    return engine.getRenderWidth() / Math.max(1, engine.getRenderHeight());
  };
  const setInitialViewport = (): void => {
    const aspectRatio = getAspectRatio();
    const verticalHalfSize = Math.max(
      config.camera.orthographicSize,
      config.playSpace.halfWidth / Math.max(aspectRatio, Number.EPSILON),
    );
    camera.orthoTop = verticalHalfSize;
    camera.orthoBottom = -verticalHalfSize;
    camera.orthoLeft = -verticalHalfSize * aspectRatio;
    camera.orthoRight = verticalHalfSize * aspectRatio;
  };
  setInitialViewport();
  scene.activeCamera = camera;

  const light = new HemisphericLight("MainLight", new Vector3(0, 0, -1), scene);
  light.intensity = 0.9;

  const playSpace = new TransformNode("PlaySpaceXY", scene);
  playSpace.position.z = config.playSpace.depth;
  playSpace.metadata = {
    halfWidth: config.playSpace.halfWidth,
    plane: "XY",
  };

  const havokInstance = await HavokPhysics({
    locateFile: () => havokWasmUrl,
  });
  const physicsPlugin = new HavokPlugin(true, havokInstance);
  const gravity = config.physics.gravity;
  scene.enablePhysics(new Vector3(gravity.x, gravity.y, gravity.z), physicsPlugin);
  scene.getPhysicsEngine()?.setTimeStep(config.simulation.fixedStepSeconds);

  return { scene, camera, cameraRig, physicsPlugin, getAspectRatio };
}
