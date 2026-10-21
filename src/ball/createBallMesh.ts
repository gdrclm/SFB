import { ToonBallMaterial } from "./ToonBallMaterial";
import { createBallFace } from "./BallFace";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import "@babylonjs/core/Rendering/outlineRenderer";
import type { Scene } from "@babylonjs/core/scene";
import type { GameConfig } from "../config/gameConfig";

export function createBallMesh(scene: Scene, config: GameConfig): Mesh {
  const ball = MeshBuilder.CreateSphere(
    "Ball",
    {
      diameter: config.ball.radius * 2,
      segments: 32,
    },
    scene,
  );

  const material = new StandardMaterial("BallMaterial", scene);
  const visual = config.ballVisual;
  material.diffuseColor = new Color3(
    visual.baseColor.r,
    visual.baseColor.g,
    visual.baseColor.b,
  );
  material.emissiveColor = material.diffuseColor.scale(
    visual.baseEmissiveStrength,
  );
  material.specularColor = new Color3(0.18, 0.18, 0.18);
  material.specularPower = 24;
  new ToonBallMaterial(material);
  ball.material = material;
  ball.renderOutline = true;
  ball.outlineColor = new Color3(
    visual.baseOutlineColor.r,
    visual.baseOutlineColor.g,
    visual.baseOutlineColor.b,
  );
  ball.outlineWidth = visual.baseOutlineWidth;

  const blueMaterial = new StandardMaterial("BallBlueDetails", scene);
  blueMaterial.diffuseColor = new Color3(0.02, 0.62, 0.95);
  blueMaterial.emissiveColor = new Color3(0.01, 0.18, 0.38);
  blueMaterial.specularColor = new Color3(0.55, 0.85, 1);
  blueMaterial.specularPower = 48;

  const darkMaterial = new StandardMaterial("BallFaceDetails", scene);
  darkMaterial.diffuseColor = new Color3(0.01, 0.045, 0.09);
  darkMaterial.emissiveColor = new Color3(0.01, 0.025, 0.055);
  darkMaterial.specularColor = new Color3(0.06, 0.09, 0.15);

  const cap = MeshBuilder.CreateTorus(
    "BallCap",
    {
      diameter: config.ball.radius * 0.72,
      thickness: config.ball.radius * 0.075,
      tessellation: 28,
    },
    scene,
  );
  cap.parent = ball;
  cap.position.set(0, config.ball.radius * 0.88, -config.ball.radius * 0.48);
  cap.rotation.x = -.5;
  cap.material = darkMaterial;
  cap.isPickable = false;

  const button = MeshBuilder.CreateSphere("BallCapButton", { diameter: config.ball.radius * .62, segments: 20 }, scene);
  button.parent = ball; button.position.copyFrom(cap.position); button.position.y += config.ball.radius * .02; button.position.z -= config.ball.radius * .01;
  button.rotation.copyFrom(cap.rotation);
  button.scaling.set(1, .18, 1); button.material = blueMaterial; button.isPickable = false;

  createBallFace(ball, config.ball.radius, darkMaterial, scene);

  return ball;
}
