import { expect, it, vi } from "vitest";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { Scene } from "@babylonjs/core/scene";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { ToonBallMaterial } from "../ball/ToonBallMaterial";
import { PlatformCrystalSkin } from "../platform/PlatformCrystalSkin";
import { PlatformIdleBlend } from "../platform/PlatformIdleBlend";
import { PlatformImpactSkin } from "../platform/PlatformImpactSkin";

it("declares all toon/rock shader uniforms when WebGL1 or a driver workaround disables uniform buffers",()=>{
  const engine=new NullEngine(),scene=new Scene(engine);
  try{
    const plugins=[new ToonBallMaterial(new StandardMaterial("ball",scene)),new PlatformCrystalSkin(new StandardMaterial("crystal",scene)),
      new PlatformIdleBlend(new StandardMaterial("idle",scene)),new PlatformImpactSkin(new StandardMaterial("impact",scene))];
    const support=vi.spyOn(engine,"supportsUniformBuffers","get");
    for(const plugin of plugins){
      support.mockReturnValue(false);const fallback=plugin.getUniforms();
      for(const uniform of fallback.ubo)expect(fallback.fragment).toContain(`uniform ${uniform.type} ${uniform.name};`);
      support.mockReturnValue(true);const native=plugin.getUniforms();expect(native.fragment).toBe("");expect(native.ubo).toEqual(fallback.ubo);
    }
  }finally{scene.dispose();engine.dispose();}
});
