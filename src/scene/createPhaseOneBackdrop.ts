import { createCrystalBackdrop } from "./createCrystalBackdrop";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import type { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { DepthLocation } from "./DepthLocations";
import type { Scene } from "@babylonjs/core/scene";

type DrawingContext = CanvasRenderingContext2D;

function drawCloud(
  context: DrawingContext,
  x: number,
  y: number,
  scale: number,
): void {
  context.save();
  context.translate(x, y);
  context.scale(scale, scale);
  context.fillStyle = "rgba(255,255,255,0.88)";
  context.shadowColor = "rgba(28,119,199,0.26)";
  context.shadowBlur = 24;
  context.beginPath();
  context.arc(-62, 18, 48, 0, Math.PI * 2);
  context.arc(-18, -8, 65, 0, Math.PI * 2);
  context.arc(48, 10, 54, 0, Math.PI * 2);
  context.arc(91, 28, 38, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawBalloon(
  context: DrawingContext,
  x: number,
  y: number,
  scale: number,
  colors: readonly [string, string],
): void {
  context.save();
  context.translate(x, y);
  context.scale(scale, scale);
  const gradient = context.createLinearGradient(-50, -80, 55, 70);
  gradient.addColorStop(0, colors[0]);
  gradient.addColorStop(1, colors[1]);
  context.fillStyle = gradient;
  context.beginPath();
  context.moveTo(0, -90);
  context.bezierCurveTo(75, -88, 86, -10, 48, 42);
  context.bezierCurveTo(27, 70, 14, 76, 0, 91);
  context.bezierCurveTo(-14, 76, -27, 70, -48, 42);
  context.bezierCurveTo(-86, -10, -75, -88, 0, -90);
  context.fill();
  context.strokeStyle = "rgba(255,255,255,0.68)";
  context.lineWidth = 8;
  context.beginPath();
  context.moveTo(-18, -82);
  context.bezierCurveTo(-42, -20, -34, 38, 0, 88);
  context.stroke();
  context.strokeStyle = "#76512e";
  context.lineWidth = 3;
  context.beginPath();
  context.moveTo(-12, 87);
  context.lineTo(-18, 122);
  context.moveTo(12, 87);
  context.lineTo(18, 122);
  context.stroke();
  context.fillStyle = "#9a6736";
  context.fillRect(-22, 119, 44, 31);
  context.restore();
}

function drawIsland(
  context: DrawingContext,
  x: number,
  y: number,
  scale: number,
): void {
  context.save();
  context.translate(x, y);
  context.scale(scale, scale);
  context.fillStyle = "rgba(24,89,133,0.34)";
  context.beginPath();
  context.moveTo(-90, 0);
  context.lineTo(92, 0);
  context.lineTo(45, 116);
  context.lineTo(5, 165);
  context.lineTo(-42, 108);
  context.closePath();
  context.fill();
  context.fillStyle = "#55b83f";
  context.beginPath();
  context.ellipse(0, -5, 98, 34, 0, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#8c673e";
  context.fillRect(-74, 8, 148, 18);
  context.restore();
}

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
  if (location === "crystal") return createCrystalBackdrop(scene, cameraRig, appearance);
  const texture = new DynamicTexture(
    "PhaseOneBackdropTexture",
    { width: 1024, height: 1536 },
    scene,
    false,
  );
  const context = texture.getContext() as unknown as CanvasRenderingContext2D;
  const sky = context.createLinearGradient(0, 0, 0, 1536);
  const palette = location === "lava" ? ["#230c24", "#55223a", "#963d35", "#ed8749"]
      : location === "abyss" ? ["#050b22", "#131b45", "#2b2258", "#12345d"]
        : appearance.theme === "world-sunset"
    ? ["#32205d", "#81458b", "#eb8c93", "#ffd69f"]
    : appearance.theme === "world-night" ? ["#050b28", "#0d2050", "#214d75", "#566e9c"]
      : ["#0758c8", "#079eed", "#55c8f6", "#b9ecff"];
  for (const [index, color] of palette.entries()) sky.addColorStop(index / 3, color);
  context.fillStyle = sky;
  context.fillRect(0, 0, 1024, 1536);

  if (location !== "sky" && (appearance.theme === "world-night" || appearance.theme === "world-sunset")) {
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
  if (location === "sky") {
  drawCloud(context, 120, 330, 1.15);
  drawCloud(context, 870, 530, 0.95);
  drawCloud(context, 400, 940, 0.7);
  drawCloud(context, 850, 1260, 1.05);
  drawBalloon(context, 145, 650, 0.72, ["#8858dd", "#4b298e"]);
  drawBalloon(context, 860, 800, 0.64, ["#ff887a", "#b53563"]);
  drawIsland(context, 260, 1140, 0.7);
  drawIsland(context, 740, 960, 0.48);
  drawIsland(context, 820, 1380, 0.62);
  } else {
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
