import { createEngine, type EngineResult } from "../rendering/createEngine";
import { createMainScene, type MainScene } from "./createMainScene";
import { preparePlatformSprites } from "../platform/PlatformSprites";
import { prepareCoinMaterials, prepareCoinGeometry } from "../coin/CoinResources";
import { RunSceneResources } from "./RunSceneResources";
import type { GameConfig } from "../config/gameConfig";
import type { WorldAppearance } from "./createPhaseOneBackdrop";
interface GameSceneSession extends EngineResult { readonly mainScene: MainScene; readonly resources: RunSceneResources; }
interface Entry { readonly promise: Promise<GameSceneSession>; cancelled: boolean; value: GameSceneSession | null; }
const sessions = new WeakMap<HTMLCanvasElement, Entry>();
/** Retain one renderer/physics world across menu visits; never retain run state. */
export async function acquireGameScene(canvas: HTMLCanvasElement, config: GameConfig, appearance: WorldAppearance): Promise<GameSceneSession> {
  let entry = sessions.get(canvas);
  if (entry === undefined) {
    entry = { promise: createSession(canvas, config, appearance), cancelled: false, value: null };
    sessions.set(canvas, entry);
  }
  try {
    const session = await entry.promise;
    if (entry.cancelled) {
      if (!session.mainScene.scene.isDisposed) session.mainScene.scene.dispose();
      if (!session.engine.isDisposed) session.engine.dispose();
      throw new Error("Scene preparation cancelled");
    }
    entry.value = session;
    return session;
  } catch (error: unknown) {
    if (sessions.get(canvas) === entry) sessions.delete(canvas);
    throw error;
  }
}
async function createSession(canvas: HTMLCanvasElement, config: GameConfig, appearance: WorldAppearance): Promise<GameSceneSession> {
  const renderer = await createEngine(canvas);
  let mainScene: MainScene | null = null;
  try {
    mainScene = await createMainScene(renderer.engine, config, appearance);
    preparePlatformSprites(mainScene.scene);
    prepareCoinMaterials(mainScene.scene);
    prepareCoinGeometry(mainScene.scene, config.coins.radius);
    return { ...renderer, mainScene, resources: new RunSceneResources(mainScene.scene) };
  } catch (error: unknown) { mainScene?.scene.dispose(); renderer.engine.dispose(); throw error; }
}
export function disposeGameScene(canvas: HTMLCanvasElement): void {
  const entry = sessions.get(canvas);
  if (entry === undefined) return;
  sessions.delete(canvas); entry.cancelled = true;
  entry.value?.mainScene.scene.dispose(); entry.value?.engine.dispose();
}
