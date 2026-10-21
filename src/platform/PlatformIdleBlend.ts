import { MaterialPluginBase } from "@babylonjs/core/Materials/materialPluginBase";
import { ShaderLanguage } from "@babylonjs/core/Materials/shaderLanguage";
import type { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import type { UniformBuffer } from "@babylonjs/core/Materials/uniformBuffer";
import type { AbstractEngine } from "@babylonjs/core/Engines/abstractEngine";
import type { SubMesh } from "@babylonjs/core/Meshes/subMesh";
import type { Scene } from "@babylonjs/core/scene";
import { IDLE_FRAME_COUNT } from "./PlatformIdle";

/** Two atlas samples in one draw: no duplicate transparent meshes or materials. */
export class PlatformIdleBlend extends MaterialPluginBase {
  public constructor(material: StandardMaterial) {
    super(material, "PlatformIdleBlend", 200, {}, true, false);
    this.registerForExtraEvents = true;
    this._enable(true);
  }

  public override isCompatible(): boolean { return true; }

  public override getUniforms(): { ubo: { name: string; size: number; type: string }[] } {
    return { ubo: [{ name: "platformIdleMix", size: 2, type: "vec2" }] };
  }

  public override hardBindForSubMesh(buffer: UniformBuffer, _scene: Scene, _engine: AbstractEngine, subMesh: SubMesh): void {
    // This runs for EVERY mesh even when all platforms share the same material.
    const sample = subMesh.getMesh().metadata as { frame?: number; nextFrame?: number; blend?: number } | null;
    buffer.updateFloat2("platformIdleMix", ((sample?.nextFrame ?? 0) - (sample?.frame ?? 0)) / IDLE_FRAME_COUNT, sample?.blend ?? 0);
  }

  public override getCustomCode(shaderType: string, language = ShaderLanguage.GLSL): Record<string, string> | null {
    if (shaderType !== "fragment") return null;
    // Blend premultiplied samples, then restore straight alpha for StandardMaterial.
    // Ordinary RGBA interpolation darkens the soft transparent edges of FX.
    if (language === ShaderLanguage.WGSL) return {
      "!baseColor=TEXRD\\(diffuseSampler,diffuseSamplerSampler,fragmentInputs.vDiffuseUV\\+uvOffset\\);": `
        let idleA = TEXRD(diffuseSampler,diffuseSamplerSampler,fragmentInputs.vDiffuseUV+uvOffset);
        let idleB = TEXRD(diffuseSampler,diffuseSamplerSampler,fragmentInputs.vDiffuseUV+uvOffset+vec2f(uniforms.platformIdleMix.x,0.0));
        let idleAlpha = mix(idleA.a,idleB.a,uniforms.platformIdleMix.y);
        baseColor = vec4f(mix(idleA.rgb*idleA.a,idleB.rgb*idleB.a,uniforms.platformIdleMix.y)/max(idleAlpha,0.00001),idleAlpha);
      `,
    };
    return {
      "!baseColor=TEXRD\\(diffuseSampler,vDiffuseUV\\+uvOffset\\);": `
        vec4 idleA = TEXRD(diffuseSampler,vDiffuseUV+uvOffset);
        vec4 idleB = TEXRD(diffuseSampler,vDiffuseUV+uvOffset+vec2(platformIdleMix.x,0.0));
        float idleAlpha = mix(idleA.a,idleB.a,platformIdleMix.y);
        baseColor = vec4(mix(idleA.rgb*idleA.a,idleB.rgb*idleB.a,platformIdleMix.y)/max(idleAlpha,0.00001),idleAlpha);
      `,
    };
  }
}
