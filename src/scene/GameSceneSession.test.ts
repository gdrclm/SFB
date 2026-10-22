import { afterEach, expect, it, vi } from "vitest";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { Scene } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import type { MainScene } from "./createMainScene";
import { createMainScene } from "./createMainScene";
import { createEngine } from "../rendering/createEngine";
import { acquireGameScene, disposeGameScene } from "./GameSceneSession";
import { gameConfig } from "../config/gameConfig";
vi.mock("../rendering/createEngine", () => ({ createEngine: vi.fn(() => Promise.resolve({ engine: new NullEngine(), renderer: "webgl2", quality: {} })) }));
vi.mock("../platform/PlatformSprites", () => ({ preparePlatformSprites: (scene: Scene) => { new StandardMaterial("SharedPlatformAtlas", scene); } }));
vi.mock("./createMainScene", () => ({ createMainScene: vi.fn((engine: NullEngine) => {
  const scene = new Scene(engine); const cameraRig = new TransformNode("rig", scene);
  const camera = new FreeCamera("camera", Vector3.Zero(), scene);
  return Promise.resolve({ scene, camera, cameraRig, getAspectRatio: () => 1, physicsPlugin: {} } as MainScene);
}) }));
afterEach(() => { vi.clearAllMocks(); });
it("keeps one scene/renderer and shared coin resources across consecutive runs and menu visits", async () => {
  const canvas = {} as HTMLCanvasElement;
  const [first, concurrent] = await Promise.all([acquireGameScene(canvas, gameConfig, {}), acquireGameScene(canvas, gameConfig, {})]);
  expect(concurrent).toBe(first);
  try {
    const original = { meshes: first.mainScene.scene.meshes.length, textures: first.mainScene.scene.textures.length, materials: first.mainScene.scene.materials.length };
    for (let run = 0; run < 8; run++) {
      const session = await acquireGameScene(canvas, gameConfig, { theme: "world-night" });
      expect(session).toBe(first);
      new Mesh("run", session.mainScene.scene);
      session.resources.clear();
      expect(session.mainScene.scene.meshes).toHaveLength(original.meshes);
      expect(session.mainScene.scene.textures).toHaveLength(original.textures);
      expect(session.mainScene.scene.materials).toHaveLength(original.materials);
    }
    expect(createEngine).toHaveBeenCalledTimes(1); expect(createMainScene).toHaveBeenCalledTimes(1);
  } finally { disposeGameScene(canvas); }
  expect(first.mainScene.scene.isDisposed).toBe(true);
});
it("discards a failed initialization so a later start can recover", async () => {
  const canvas = {} as HTMLCanvasElement;
  vi.mocked(createMainScene).mockRejectedValueOnce(new Error("physics unavailable"));
  await expect(acquireGameScene(canvas, gameConfig, {})).rejects.toThrow("physics unavailable");
  const recovered = await acquireGameScene(canvas, gameConfig, {});
  expect(recovered.mainScene.scene.isDisposed).toBe(false); expect(createEngine).toHaveBeenCalledTimes(2);
  disposeGameScene(canvas);
});

it("cancels every concurrent waiter on page exit and permits a clean later acquisition", async () => {
  const canvas = {} as HTMLCanvasElement;
  const original = vi.mocked(createMainScene).getMockImplementation();
  if (original === undefined) throw new Error("Missing scene factory");
  const gate = { release: () => {} };
  const blocked = new Promise<void>(resolve => { gate.release = resolve; });
  vi.mocked(createMainScene).mockImplementationOnce(async (...args) => { await blocked; return original(...args); });
  const first = acquireGameScene(canvas, gameConfig, {});
  const second = acquireGameScene(canvas, gameConfig, {});
  disposeGameScene(canvas); gate.release();
  const results = await Promise.allSettled([first, second]);
  expect(results.map(result => result.status)).toEqual(["rejected", "rejected"]);
  const recovered = await acquireGameScene(canvas, gameConfig, {});
  expect(recovered.mainScene.scene.isDisposed).toBe(false); disposeGameScene(canvas);
});
