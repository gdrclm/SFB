import { expect, it } from "vitest";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { Scene } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { RunSceneResources } from "./RunSceneResources";
it("retains the engine and scene backdrop while releasing repeated run resources", () => {
  const engine = new NullEngine();
  const scene = new Scene(engine);
  const background = new Mesh("background", scene);
  const material = new StandardMaterial("background", scene);
  background.material = material;
  const resources = new RunSceneResources(scene);
  for (let run = 0; run < 5; run++) {
    const ball = new Mesh("ball", scene);
    ball.material = new StandardMaterial("ball", scene);
    resources.clear();
    expect(ball.isDisposed()).toBe(true);
    expect(scene.meshes).toEqual([background]);
    expect(scene.materials).toEqual([material]);
    expect(engine.scenes).toEqual([scene]);
    expect(scene.isDisposed).toBe(false);
  }
  scene.dispose(); engine.dispose();
});
