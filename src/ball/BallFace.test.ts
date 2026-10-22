import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { Scene } from "@babylonjs/core/scene";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { expect, it } from "vitest";
import { createBallFace, getBallFace } from "./BallFace";
it("replaces normal eyes with crosses and animates an exposed tongue only during defeat", () => {
  const engine = new NullEngine(); const scene = new Scene(engine);
  try {
    const ball = MeshBuilder.CreateSphere("ball", {}, scene);
    createBallFace(ball, .5, new StandardMaterial("dark", scene), scene);
    const face = getBallFace(ball);
    const tongue = scene.getMeshByName("BallDefeatTongue");
    expect(tongue?.isEnabled()).toBe(false);
    face?.update("defeat", .1, 0);
    expect(tongue?.isEnabled()).toBe(true);
    expect(scene.meshes.filter(mesh => mesh.name.startsWith("BallDefeatEye") && mesh.isEnabled())).toHaveLength(4);
    expect(scene.getMeshByName("BallEyeLeft")?.isEnabled()).toBe(false);
    const stretch = tongue?.scaling.y;
    face?.update("defeat", .1, 0); expect(tongue?.scaling.y).not.toBe(stretch);
    face?.update("neutral", .1, 0);
    expect(tongue?.isEnabled()).toBe(false); expect(scene.getMeshByName("BallEyeLeft")?.isEnabled()).toBe(true);
  } finally { scene.dispose(); engine.dispose(); }
});
