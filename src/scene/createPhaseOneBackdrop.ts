import { createIllustratedBackdrop } from "./createIllustratedBackdrop";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import type { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { DepthLocation } from "./DepthLocations";
import type { Scene } from "@babylonjs/core/scene";

export interface WorldAppearance {
  readonly theme?: string;
  readonly lanterns?: boolean;
}

export function createPhaseOneBackdrop(
  scene: Scene,
  cameraRig: TransformNode,
  appearance: WorldAppearance = {},
  location: DepthLocation = "sky",
): Mesh {
  if (location === "sky" || location === "crystal") return createIllustratedBackdrop(scene, cameraRig, appearance, location);
  const texture = new DynamicTexture(
    "PhaseOneBackdropTexture",
    { width: 1024, height: 1536 },
    scene,
    false,
  );
  const context = texture.getContext() as unknown as CanvasRenderingContext2D;
  const sky = context.createLinearGradient(0, 0, 0, 1536);
  const palette = location === "lava" ? ["#230c24", "#55223a", "#963d35", "#ed8749"]
    : ["#050b22", "#131b45", "#2b2258", "#12345d"];
  for (const [index, color] of palette.entries()) sky.addColorStop(index / 3, color);
  context.fillStyle = sky;
  context.fillRect(0, 0, 1024, 1536);

  if (appearance.theme === "world-night" || appearance.theme === "world-sunset") {
    context.fillStyle = appearance.theme === "world-night" ? "#070c3244" : "#8b326333";
    context.fillRect(0, 0, 1024, 1536);
  }
  if (appearance.theme === "world-night") {
    context.fillStyle = "#e4f7ff";
    for (let i = 0; i < 65; i++) {
      context.beginPath(); context.arc((i * 173 + 41) % 1024, (i * 257 + 93) % 1536, i % 3 + 1, 0, Math.PI * 2); context.fill();
    }
  }
  if (appearance.lanterns === true) {
    for (let i = 0; i < 8; i++) {
      const x = (i * 337 + 60) % 1024;
      const y = (i * 229 + 120) % 1536;
      context.save();
      context.fillStyle = "#ffd67d"; context.shadowColor = "#ffb338"; context.shadowBlur = 30;
      context.beginPath(); context.roundRect(x, y, 35, 48, 10); context.fill();
      context.fillStyle = "#ff8138"; context.fillRect(x + 11, y + 35, 13, 10);
      context.restore();
    }
  }
  // Large silhouettes at the edges keep the playable corridor quiet.
  for (let i = 0; i < 12; i++) {
    const y = i * 145 - 30;
    for (const side of [-1, 1]) {
      const x = side < 0 ? 0 : 1024;
      const reach = 85 + (i * 47 % 100);
      context.fillStyle = location === "lava" ? "#341a30" : "#0a183a";
      context.beginPath(); context.moveTo(x, y - 50); context.lineTo(x - side * reach, y + 30);
      context.lineTo(x - side * reach * .65, y + 120); context.lineTo(x, y + 180); context.fill();
      if (location === "lava") {
        context.strokeStyle = "#ffb464"; context.lineWidth = 5; context.beginPath();
        context.moveTo(x - side * 30, y); context.lineTo(x - side * 65, y + 55);
        context.lineTo(x - side * 38, y + 110); context.stroke();
      }
    }
  }
  if (location === "abyss") {
    for (let i = 0; i < 55; i++) {
      context.fillStyle = i % 3 ? "#77d5d488" : "#b8a5dfaa";
      context.beginPath(); context.arc((i * 173 + 41) % 1024, (i * 257 + 93) % 1536, i % 3 + 1, 0, Math.PI * 2); context.fill();
    }
    context.strokeStyle = "#887bd344"; context.lineWidth = 22;
    context.beginPath(); context.moveTo(30, 100); context.bezierCurveTo(180, 500, 70, 900, 150, 1536); context.stroke();
    context.beginPath(); context.moveTo(1000, 0); context.bezierCurveTo(800, 600, 970, 900, 880, 1536); context.stroke();
  }

  texture.update(false);
  texture.wrapU = Texture.CLAMP_ADDRESSMODE;
  texture.wrapV = Texture.CLAMP_ADDRESSMODE;

  const material = new StandardMaterial("PhaseOneBackdropMaterial", scene);
  material.diffuseTexture = texture;
  material.emissiveColor = Color3.White();
  material.specularColor = Color3.Black();
  material.disableLighting = true;
  material.backFaceCulling = false;

  const backdrop = MeshBuilder.CreatePlane(
    "PhaseOneBackdrop",
    { width: 28, height: 42, sideOrientation: Mesh.DOUBLESIDE },
    scene,
  );
  backdrop.parent = cameraRig;
  backdrop.position.z = 6;
  backdrop.isPickable = false;
  backdrop.material = material;
  backdrop.metadata = { location };
  return backdrop;
}
