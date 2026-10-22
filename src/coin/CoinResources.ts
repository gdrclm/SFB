import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import type { Scene } from "@babylonjs/core/scene";
interface CoinMaterials { readonly body: StandardMaterial; readonly face: StandardMaterial; }
const materials = new WeakMap<Scene, CoinMaterials>();
/** One painted face and two shared materials for the entire coin pool. */
export function prepareCoinMaterials(scene: Scene): CoinMaterials {
  const cached = materials.get(scene);
  if (cached !== undefined) return cached;
  const body = new StandardMaterial("CoinBodyMaterial", scene);
  body.diffuseColor = new Color3(1, 0.61, 0.01);
  body.emissiveColor = new Color3(0.35, 0.12, 0.005);
  body.specularColor = new Color3(1, 0.88, 0.32);
  body.specularPower = 48;

  const texture =
    typeof OffscreenCanvas !== "undefined" || typeof document !== "undefined"
      ? new DynamicTexture(
          "CoinFaceTexture",
          { width: 128, height: 128 },
          scene,
          false,
        )
      : null;
  if (texture !== null) {
    const context = texture.getContext() as unknown as CanvasRenderingContext2D;
    context.clearRect(0, 0, 128, 128);
    const gradient = context.createRadialGradient(48, 38, 8, 64, 64, 58);
    gradient.addColorStop(0, "#fff9a6");
    gradient.addColorStop(0.55, "#ffc400");
    gradient.addColorStop(1, "#d36a00");
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(64, 64, 60, 0, Math.PI * 2);
    context.fill();
    context.lineWidth = 7;
    context.strokeStyle = "#7b3500";
    context.stroke();
    context.font = "900 74px Arial Black, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.lineWidth = 8;
    context.strokeStyle = "#9b4c00";
    context.strokeText("★", 64, 66);
    context.fillStyle = "#fff07a";
    context.fillText("★", 64, 66);
    texture.update(false);
  }

  const face = new StandardMaterial(
    "CoinFaceMaterial",
    scene,
  );
  if (texture !== null) {
    face.diffuseTexture = texture;
  } else {
    face.diffuseColor = new Color3(1, 0.75, 0.04);
  }
  face.emissiveColor = new Color3(0.3, 0.12, 0);
  face.specularColor = new Color3(1, 0.85, 0.25);
  face.backFaceCulling = false;

  const result = { body, face };
  materials.set(scene, result);
  scene.onDisposeObservable.addOnce(() => { materials.delete(scene); });
  return result;
}

interface CoinGeometry { readonly body: Mesh; readonly face: Mesh; }
const geometries = new WeakMap<Scene, Map<number, CoinGeometry>>();
/** The whole pool shares two vertex buffers, not 72 independently built shapes. */
export function prepareCoinGeometry(scene: Scene, radius: number): CoinGeometry {
  let cache = geometries.get(scene);
  if (cache === undefined) {
    cache = new Map(); geometries.set(scene, cache);
    scene.onDisposeObservable.addOnce(() => { geometries.delete(scene); });
  }
  const cached = cache.get(radius);
  if (cached !== undefined) return cached;
  const body = MeshBuilder.CreateCylinder("CoinBodyPrototype", { diameter: radius * 2, height: radius * .28, tessellation: 24 }, scene);
  const face = MeshBuilder.CreateDisc("CoinFacePrototype", { radius: radius * .88, tessellation: 32 }, scene);
  body.setEnabled(false); face.setEnabled(false); body.isPickable = false; face.isPickable = false;
  const result = { body, face }; cache.set(radius, result); return result;
}
