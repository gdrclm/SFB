import crystalUrl from "../assets/worlds/neon-crystal.webp";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { Scene } from "@babylonjs/core/scene";
import type { WorldAppearance } from "./createPhaseOneBackdrop";

export function preloadCrystalBackdrop(): void {
  const image = new Image();
  image.src = crystalUrl;
}

export function createCrystalBackdrop(scene: Scene, rig: TransformNode, appearance: WorldAppearance): Mesh {
  const material = new StandardMaterial("CrystalBackdropMaterial", scene);
  material.disableLighting = true;
  material.specularColor = Color3.Black();
  material.emissiveColor = appearance.theme === "world-night" ? new Color3(.72, .8, 1)
    : appearance.theme === "world-sunset" ? new Color3(1, .82, .94) : Color3.White();
  let texture: Texture | null = null;
  texture = new Texture(crystalUrl, scene, true, true, Texture.BILINEAR_SAMPLINGMODE, undefined, () => {
    // Keep the run playable even if the illustration fails to load.
    material.diffuseTexture = null;
    texture?.dispose();
    material.emissiveColor = new Color3(.025, .045, .12);
  });
  texture.name = "CrystalBackdropTexture";
  texture.wrapU = texture.wrapV = Texture.CLAMP_ADDRESSMODE;
  material.diffuseTexture = texture;
  const mesh = MeshBuilder.CreatePlane("CrystalBackdrop", { width: 28, height: 42 }, scene);
  mesh.parent = rig; mesh.position.z = 6; mesh.isPickable = false; mesh.material = material;
  mesh.metadata = { location: "crystal", imageAspect: 941 / 1672 };
  if (appearance.lanterns === true) addLanterns(scene, mesh);
  return mesh;
}

function addLanterns(scene: Scene, parent: Mesh): void {
  const texture = new DynamicTexture("CrystalLanternsTexture", { width: 512, height: 768 }, scene, false);
  texture.hasAlpha = true;
  const context = texture.getContext();
  for (let i = 0; i < 6; i++) {
    const x = i % 2 ? 475 : 22, y = i * 121 + 24;
    context.fillStyle = "#ffd67d"; context.shadowColor = "#ffb338"; context.shadowBlur = 14;
    context.fillRect(x, y, 14, 22);
  }
  texture.update(false);
  const material = new StandardMaterial("CrystalLanternsMaterial", scene);
  material.diffuseTexture = texture; material.useAlphaFromDiffuseTexture = true;
  material.disableLighting = true; material.emissiveColor = Color3.White();
  const mesh = MeshBuilder.CreatePlane("CrystalLanterns", { width: 28, height: 42 }, scene);
  mesh.parent = parent; mesh.position.z = -.02; mesh.material = material; mesh.isPickable = false;
}
