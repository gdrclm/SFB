import { MaterialPluginBase } from "@babylonjs/core/Materials/materialPluginBase";
import { ShaderLanguage } from "@babylonjs/core/Materials/shaderLanguage";
import type { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import type { UniformBuffer } from "@babylonjs/core/Materials/uniformBuffer";
import type { AbstractEngine } from "@babylonjs/core/Engines/abstractEngine";
import type { SubMesh } from "@babylonjs/core/Meshes/subMesh";
import type { Scene } from "@babylonjs/core/scene";
import { IDLE_FRAME_COUNT } from "./PlatformIdle";

/** Cubic temporal filtering and short state crossfades in a single draw call. */
export class PlatformIdleBlend extends MaterialPluginBase {
  public constructor(material: StandardMaterial) {
    super(material, "PlatformIdleBlend", 200, {}, true, false);
    this.registerForExtraEvents = true;
    this._enable(true);
  }

  public override isCompatible(): boolean { return true; }

  public override getUniforms(): { ubo: { name: string; size: number; type: string }[] } {
    return { ubo: [{ name: "platformIdleMix", size: 4, type: "vec4" }, { name: "platformStateMix", size: 3, type: "vec3" }] };
  }

  public override hardBindForSubMesh(buffer: UniformBuffer, _scene: Scene, _engine: AbstractEngine, subMesh: SubMesh): void {
    // This runs for EVERY mesh even when all platforms share the same material.
    const sample = subMesh.getMesh().metadata as { frame?: number; nextFrame?: number; blend?: number; idleFrames?: number; row?: number; previousRow?: number; rowBlend?: number } | null;
    const frame = sample?.frame ?? 0;
    const delta = (pose: number): number => (pose - frame) / IDLE_FRAME_COUNT;
    buffer.updateFloat4("platformIdleMix", delta((frame + 11) % 12), delta(sample?.nextFrame ?? frame), delta((frame + 2) % 12), sample?.blend ?? 0);
    buffer.updateFloat3("platformStateMix", ((sample?.row ?? 0) - (sample?.previousRow ?? sample?.row ?? 0)) / 5, sample?.rowBlend ?? 1, sample?.idleFrames === 12 ? 1 : 0);
  }

  public override getCustomCode(shaderType: string, language = ShaderLanguage.GLSL): Record<string, string> | null {
    if (shaderType !== "fragment") return null;
    const wgsl = language === ShaderLanguage.WGSL;
    const vec2 = wgsl ? "vec2f" : "vec2", vec4 = wgsl ? "vec4f" : "vec4";
    const mix = wgsl ? "uniforms.platformIdleMix" : "platformIdleMix";
    const state = wgsl ? "uniforms.platformStateMix" : "platformStateMix";
    const uv = wgsl ? "fragmentInputs.vDiffuseUV+uvOffset" : "vDiffuseUV+uvOffset";
    const sample = (offset: string): string => wgsl
      ? `TEXRD(diffuseSampler,diffuseSamplerSampler,${uv}+${offset})`
      : `TEXRD(diffuseSampler,${uv}+${offset})`;
    const declare = (name: string, type: string, value: string): string => wgsl ? `var ${name} = ${value};` : `${type} ${name} = ${value};`;
    const premultiply = (name: string): string => `${name} = ${vec4}(${name}.rgb*${name}.a,${name}.a);`;
    // Cubic B-spline weights eliminate velocity discontinuities between the 12
    // source drawings. The loop still lasts exactly one second. Destruction
    // retains linear interpolation so the first contact remains instantaneous.
    const filter = (suffix: string, rowOffset: string): string => {
      const names = [`a${suffix}`, `b${suffix}`, `c${suffix}`, `d${suffix}`] as const;
      const offsets = ["0.0", `${mix}.y`, `${mix}.x`, `${mix}.z`] as const;
      return names.map((name, i) => declare(name, vec4, sample(`${vec2}(${offsets[i] ?? "0.0"},${rowOffset})`)) + premultiply(name)).join("\n")
        + declare(`filtered${suffix}`, vec4, `mix(${names[0]},${names[1]},${mix}.w)`)
        + `if (${state}.z > 0.5) { filtered${suffix} = ${names[2]}*weights.x+${names[0]}*weights.y+${names[1]}*weights.z+${names[3]}*weights.w; }`;
    };
    const code = `
      ${declare("t", "float", `${mix}.w`)}
      ${declare("u", "float", "1.0-t")}
      ${declare("weights", vec4, `${vec4}(u*u*u,3.0*t*t*t-6.0*t*t+4.0,-3.0*t*t*t+3.0*t*t+3.0*t+1.0,t*t*t)/6.0`)}
      ${filter("Now", "0.0")}
      if (${state}.y < 1.0) {
        ${filter("Old", `${state}.x`)}
        filteredNow = mix(filteredOld,filteredNow,${state}.y);
      }
      baseColor = ${vec4}(filteredNow.rgb/max(filteredNow.a,0.00001),filteredNow.a);
    `;
    return { [wgsl
      ? "!baseColor=TEXRD\\(diffuseSampler,diffuseSamplerSampler,fragmentInputs.vDiffuseUV\\+uvOffset\\);"
      : "!baseColor=TEXRD\\(diffuseSampler,vDiffuseUV\\+uvOffset\\);"]: code };
  }
}
