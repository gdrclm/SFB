import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import type { BaseTexture } from "@babylonjs/core/Materials/Textures/baseTexture";
import type { Scene } from "@babylonjs/core/scene";
const textures = new WeakMap<Scene, Map<string, Texture>>();
const retained = new WeakSet<BaseTexture>();
/** One GPU owner per scenery image. Run materials receive disposable leases. */
export function sceneryTexture(url: string, scene: Scene, onError?: () => void): Texture {
  let cache = textures.get(scene);
  if (cache === undefined) {
    cache = new Map(); textures.set(scene, cache);
    scene.onDisposeObservable.addOnce(() => { textures.delete(scene); });
  }
  if (!cache.has(url)) {
    const owner = new Texture(url, scene, true, true, Texture.BILINEAR_SAMPLINGMODE);
    retained.add(owner); cache.set(url, owner);
    owner.onDisposeObservable.addOnce(() => { if (cache.get(url) === owner) cache.delete(url); });
  }
  return new Texture(url, scene, true, true, Texture.BILINEAR_SAMPLINGMODE, undefined, onError);
}
export function isRetainedSceneryTexture(texture: BaseTexture): boolean { return retained.has(texture); }
