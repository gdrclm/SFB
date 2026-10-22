import { expect, it } from "vitest";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { Scene } from "@babylonjs/core/scene";
import { gameConfig } from "../config/gameConfig";
import { createCoins } from "./CoinController";
import { prepareCoinGeometry, prepareCoinMaterials } from "./CoinResources";
import { RunSceneResources } from "../scene/RunSceneResources";
it("reuses coin geometry and materials, survives disposal of a collected coin and keeps a stable resource count on retry", () => {
  const engine = new NullEngine(); const scene = new Scene(engine);
  try {
    prepareCoinGeometry(scene, gameConfig.coins.radius); prepareCoinMaterials(scene);
    const resources = new RunSceneResources(scene);
    const materials = scene.materials.length;
    for (let run = 0; run < 4; run++) {
      const coins = createCoins(scene, gameConfig);
      const a = coins[0], b = coins[1];
      expect(a?.mesh.geometry).toBe(b?.mesh.geometry); expect(a?.mesh.material).toBe(b?.mesh.material);
      a?.dispose(); expect(b?.mesh.geometry?.isDisposed()).toBe(false);
      expect(scene.materials).toHaveLength(materials);
      for (const coin of coins.slice(1)) coin.dispose(); resources.clear();
      expect(scene.meshes).toHaveLength(2); expect(scene.materials).toHaveLength(materials);
    }
  } finally { scene.dispose(); engine.dispose(); }
});
