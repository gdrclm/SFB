import { sceneryTexture } from "./SceneTextures";
import crystalObjectUrl from "../assets/worlds/neon-crystal-object-atlas.webp";
import crystalCloudUrl from "../assets/worlds/neon-crystal-clouds.webp";
import crystalUrl from "../assets/worlds/neon-crystal-distance.webp";
import skyDistanceUrl from "../assets/worlds/sky-islands-distance.webp";
import ruinsDistanceUrl from "../assets/worlds/ruins-distance.png";
import ruinsAtlasUrl from "../assets/worlds/ruins-scenery-atlas.png";
import {RuinsScenery} from "./RuinsScenery";
import { BackdropScenery } from "./BackdropScenery";
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
  for (const url of [crystalObjectUrl, crystalCloudUrl,ruinsDistanceUrl,ruinsAtlasUrl]) {
    const image = new Image(); image.src = url;
  }
}

export function createIllustratedBackdrop(
  scene: Scene,
  rig: TransformNode,
  appearance: WorldAppearance,
  location: "sky" | "crystal" | "lava",
): Mesh {
  const prefix = location === "sky" ? "Sky" : location==="lava"?"Ruins":"Crystal";
  const url = location === "sky" ? skyDistanceUrl : location==="lava"?ruinsDistanceUrl:crystalUrl;
  const material = new StandardMaterial(`${prefix}BackdropMaterial`, scene);
  material.disableLighting = true;
  material.specularColor = Color3.Black();
  material.emissiveColor = appearance.theme === "world-night" ? new Color3(.72, .8, 1)
    : appearance.theme === "world-sunset" ? new Color3(1, .82, .94) : Color3.White();
  let texture: Texture | null = null;
  texture = sceneryTexture(url, scene, () => {
    // Keep the run playable even if the illustration fails to load.
    material.diffuseTexture = null;
    texture?.dispose();
    material.emissiveColor = location === "sky" ? new Color3(.12, .68, .94) : location==="lava"?new Color3(.08,.045,.025):new Color3(.025, .045, .12);
  });
  texture.name = `${prefix}BackdropTexture`;
  texture.wrapU = texture.wrapV = Texture.CLAMP_ADDRESSMODE;
  material.diffuseTexture = texture;
  const mesh = MeshBuilder.CreatePlane(`${prefix}Backdrop`, { width: 28, height: 42 }, scene);
  mesh.parent = rig; mesh.position.z = 6; mesh.isPickable = false; mesh.material = material;
  mesh.metadata = { location, scenery: location==="lava"?new RuinsScenery(scene,mesh):new BackdropScenery(scene, mesh, location) };
  if (appearance.lanterns === true&&location!=="lava") addLanterns(scene, mesh, prefix);
  return mesh;
}

function addLanterns(scene: Scene, parent: Mesh, prefix: string): void {
  const texture = new DynamicTexture(`${prefix}LanternsTexture`, { width: 512, height: 768 }, scene, false);
  texture.hasAlpha = true;
  const context = texture.getContext();
  for (let i = 0; i < 6; i++) {
    const x = i % 2 ? 475 : 22, y = i * 121 + 24;
    context.fillStyle = "#ffd67d"; context.shadowColor = "#ffb338"; context.shadowBlur = 14;
    context.fillRect(x, y, 14, 22);
  }
  texture.update(false);
  const material = new StandardMaterial(`${prefix}LanternsMaterial`, scene);
  material.diffuseTexture = texture; material.useAlphaFromDiffuseTexture = true;
  material.disableLighting = true; material.emissiveColor = Color3.White();
  const mesh = MeshBuilder.CreatePlane(`${prefix}Lanterns`, { width: 28, height: 42 }, scene);
  mesh.parent = parent; mesh.position.z = -.02; mesh.material = material; mesh.isPickable = false;
}
