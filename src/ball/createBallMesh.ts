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
      segments: 24,
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
  darkMaterial.specularColor = new Color3(0.35, 0.6, 0.8);

  const cap = MeshBuilder.CreateTorus(
    "BallCap",
    {
      diameter: config.ball.radius * 0.72,
      thickness: config.ball.radius * 0.17,
      tessellation: 28,
    },
    scene,
  );
  cap.parent = ball;
  cap.position.set(0, config.ball.radius * 0.7, -config.ball.radius * 0.56);
  cap.rotation.x = Math.PI / 2;
  cap.material = blueMaterial;
  cap.isPickable = false;

  const lowerBand = MeshBuilder.CreateTorus(
    "BallLowerBand",
    {
      diameter: config.ball.radius * 1.7,
      thickness: config.ball.radius * 0.12,
      tessellation: 32,
    },
    scene,
  );
  lowerBand.parent = ball;
  lowerBand.position.set(0, -config.ball.radius * 0.42, -config.ball.radius * 0.84);
  lowerBand.rotation.x = Math.PI / 2;
  lowerBand.scaling.y = 0.24;
  lowerBand.material = blueMaterial;
  lowerBand.isPickable = false;

  for (const direction of [-1, 1]) {
    const eye = MeshBuilder.CreateSphere(
      direction < 0 ? "BallEyeLeft" : "BallEyeRight",
      { diameter: config.ball.radius * 0.22, segments: 12 },
      scene,
    );
    eye.parent = ball;
    eye.position.set(
      direction * config.ball.radius * 0.34,
      -config.ball.radius * 0.02,
      -config.ball.radius * 0.95,
    );
    eye.scaling.y = 1.55;
    eye.scaling.x = 0.72;
    eye.material = darkMaterial;
    eye.isPickable = false;
  }

  return ball;
}
