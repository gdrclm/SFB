import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import type { BaseTexture } from "@babylonjs/core/Materials/Textures/baseTexture";
import type { Scene } from "@babylonjs/core/scene";
interface SceneryImage {owner:Texture;leases:Set<Texture>}
const textures = new WeakMap<Scene, Map<string, SceneryImage>>();
const retained = new WeakSet<BaseTexture>();
/** One GPU owner per scenery image. Run materials receive disposable leases. */
export function sceneryTexture(url: string, scene: Scene, onError?: () => void): Texture {
  let cache = textures.get(scene);
  if (cache === undefined) {
    cache = new Map(); textures.set(scene, cache);
    scene.onDisposeObservable.addOnce(() => { textures.delete(scene); });
  }
  let image=cache.get(url);
  if(image?.owner.loadingError){
    // A cached failed InternalTexture will never emit its old error to a new
    // lease. Release every failed reference before retrying the same URL.
    cache.delete(url);
    for(const lease of [...image.leases])lease.dispose();
    image.owner.dispose();image=undefined;
  }
  if (image===undefined) {
    const owner = new Texture(url, scene, true, true, Texture.BILINEAR_SAMPLINGMODE);
    image={owner,leases:new Set()};
    const created=image;
    retained.add(owner); cache.set(url, created);
    owner.onDisposeObservable.addOnce(() => { if (cache.get(url) === created) cache.delete(url); });
  }
  const lease=new Texture(url, scene, true, true, Texture.BILINEAR_SAMPLINGMODE, undefined, onError);
  const leasedImage=image;
  leasedImage.leases.add(lease);
  lease.onDisposeObservable.addOnce(()=>{leasedImage.leases.delete(lease);});
  return lease;
}
export function isRetainedSceneryTexture(texture: BaseTexture): boolean { return retained.has(texture); }
