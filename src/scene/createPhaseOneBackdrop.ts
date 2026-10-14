import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import type { TransformNode } from "@babylonjs/core/Meshes/transformNode";
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

export function createPhaseOneBackdrop(
  scene: Scene,
  cameraRig: TransformNode,
): Mesh {
  const texture = new DynamicTexture(
    "PhaseOneBackdropTexture",
    { width: 1024, height: 1536 },
    scene,
    false,
  );
  const context = texture.getContext() as unknown as CanvasRenderingContext2D;
  const sky = context.createLinearGradient(0, 0, 0, 1536);
  sky.addColorStop(0, "#0758c8");
  sky.addColorStop(0.34, "#079eed");
  sky.addColorStop(0.72, "#55c8f6");
  sky.addColorStop(1, "#b9ecff");
  context.fillStyle = sky;
  context.fillRect(0, 0, 1024, 1536);

  drawCloud(context, 120, 330, 1.15);
  drawCloud(context, 870, 530, 0.95);
  drawCloud(context, 400, 940, 0.7);
  drawCloud(context, 850, 1260, 1.05);
  drawBalloon(context, 145, 650, 0.72, ["#8858dd", "#4b298e"]);
  drawBalloon(context, 860, 800, 0.64, ["#ff887a", "#b53563"]);
  drawIsland(context, 260, 1140, 0.7);
  drawIsland(context, 740, 960, 0.48);
  drawIsland(context, 820, 1380, 0.62);

  const confettiColors = ["#ff5eb5", "#ffe348", "#47efbb", "#ff7b4c"];
  for (let index = 0; index < 28; index += 1) {
    const x = (index * 173 + 91) % 1024;
    const y = (index * 281 + 170) % 1536;
    context.save();
    context.translate(x, y);
    context.rotate((index * Math.PI) / 9);
    context.fillStyle = confettiColors[index % confettiColors.length] ?? "#fff";
    context.fillRect(-7, -16, 14, 32);
    context.restore();
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
  return backdrop;
}
