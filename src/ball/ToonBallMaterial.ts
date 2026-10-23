import { MaterialPluginBase } from "@babylonjs/core/Materials/materialPluginBase";
import { ShaderLanguage } from "@babylonjs/core/Materials/shaderLanguage";
import type { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";

import type { UniformBuffer } from "@babylonjs/core/Materials/uniformBuffer";

const crystalBlends = new WeakMap<StandardMaterial, number>();
export function setToonBallCrystalBlend(material: StandardMaterial, blend: number): void {
  crystalBlends.set(material, blend);
}

/** Analytic toon key/rim lighting follows the sphere normals, including squash. */
export class ToonBallMaterial extends MaterialPluginBase {
  readonly #ballMaterial: StandardMaterial;
  public constructor(material: StandardMaterial) {
    super(material, "ToonBall", 210, {}, true, false);
    this.#ballMaterial = material;
    this.registerForExtraEvents = true;
    this._enable(true);
  }
  public override getUniforms(): { ubo: { name: string; size: number; type: string }[] } {
    return { ubo: [{ name: "ballCrystalBlend", size: 1, type: "float" }] };
  }
  public override hardBindForSubMesh(buffer: UniformBuffer): void {
    buffer.updateFloat("ballCrystalBlend", crystalBlends.get(this.#ballMaterial) ?? 0);
  }
  public override isCompatible(): boolean { return true; }
  public override getCustomCode(type: string, language = ShaderLanguage.GLSL): Record<string, string> | null {
    const wgsl = language === ShaderLanguage.WGSL;
    const scalar = wgsl ? "let" : "float", vector = wgsl ? "vec3f" : "vec3";
    const varying = wgsl ? "varying vBallLocal: vec3f;" : "varying vec3 vBallLocal;";
    if (type === "vertex") return {
      CUSTOM_VERTEX_DEFINITIONS: varying,
      CUSTOM_VERTEX_UPDATE_POSITION: `${wgsl ? "vertexOutputs.vBallLocal" : "vBallLocal"}=normalize(positionUpdated);`,
    };
    if (type !== "fragment") return null;
    const crystal = wgsl ? "uniforms.ballCrystalBlend" : "ballCrystalBlend";
    const local = wgsl ? "fragmentInputs.vBallLocal" : "vBallLocal";
    return { CUSTOM_FRAGMENT_DEFINITIONS: varying, CUSTOM_FRAGMENT_BEFORE_FOG: `
      ${scalar} toonLight = dot(normalW,normalize(${vector}(-0.55,0.7,-1.0)));
      ${scalar} toonBand = 0.64+0.20*smoothstep(0.20,0.35,toonLight)+0.16*smoothstep(0.64,0.82,toonLight);
      ${scalar} toonRim = pow(1.0-clamp(dot(normalW,${vector}(0.0,0.0,-1.0)),0.0,1.0),3.0);
      ${scalar} toonShine = smoothstep(0.976,0.994,toonLight);
      ${scalar} shellEdge = ${local}.y+0.035*sin(${local}.x*7.0);
      ${scalar} shellMask = 1.0-smoothstep(-0.51,-0.48,shellEdge);
      ${scalar} shellSeam = 1.0-smoothstep(0.006,0.022,abs(shellEdge+0.49));
      ${wgsl ? "let" : "vec3"} shellBlue = mix(${vector}(0.01,0.22,0.95),${vector}(0.02,0.72,1.0),0.5+0.5*sin(${local}.x*6.0+${local}.z*3.0));
      ${scalar} innerLight = exp(-dot(${local}.xy,${local}.xy)*2.4);
      ${wgsl ? "let" : "vec3"} crystalLight = ${vector}(0.10,0.78,1.0)*(0.20+innerLight*0.38+toonRim*1.25)+${vector}(0.35,0.10,0.85)*toonRim*0.20;
      color = ${wgsl ? "vec4f" : "vec4"}(mix(diffuseColor,shellBlue,shellMask)*toonBand+emissiveColor*0.08+${vector}(0.10,0.65,1.0)*(toonRim*0.5+shellSeam*0.3)+${vector}(1.0)*toonShine*0.18+crystalLight*${crystal},color.a);
    ` };
  }
}
