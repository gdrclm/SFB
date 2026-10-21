import { MaterialPluginBase } from "@babylonjs/core/Materials/materialPluginBase";
import { ShaderLanguage } from "@babylonjs/core/Materials/shaderLanguage";
import type { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";

/** Analytic toon key/rim lighting follows the sphere normals, including squash. */
export class ToonBallMaterial extends MaterialPluginBase {
  public constructor(material: StandardMaterial) { super(material, "ToonBall", 210, {}, true, true); }
  public override isCompatible(): boolean { return true; }
  public override getCustomCode(type: string, language = ShaderLanguage.GLSL): Record<string, string> | null {
    if (type !== "fragment") return null;
    const wgsl = language === ShaderLanguage.WGSL;
    const scalar = wgsl ? "let" : "float", vector = wgsl ? "vec3f" : "vec3";
    return { CUSTOM_FRAGMENT_BEFORE_FOG: `
      ${scalar} toonLight = dot(normalW,normalize(${vector}(-0.55,0.7,-1.0)));
      ${scalar} toonBand = 0.56+0.20*smoothstep(0.24,0.29,toonLight)+0.24*smoothstep(0.68,0.73,toonLight);
      ${scalar} toonRim = pow(1.0-clamp(dot(normalW,${vector}(0.0,0.0,-1.0)),0.0,1.0),3.0);
      ${scalar} toonShine = smoothstep(0.976,0.994,toonLight);
      color = ${wgsl ? "vec4f" : "vec4"}(diffuseColor*toonBand+emissiveColor*0.12+${vector}(0.12,0.52,0.7)*toonRim*0.35+${vector}(1.0)*toonShine*0.18,color.a);
    ` };
  }
}
