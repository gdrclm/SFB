import { MaterialPluginBase } from "@babylonjs/core/Materials/materialPluginBase";
import { ShaderLanguage } from "@babylonjs/core/Materials/shaderLanguage";
import type { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import type { UniformBuffer } from "@babylonjs/core/Materials/uniformBuffer";
import type { AbstractEngine } from "@babylonjs/core/Engines/abstractEngine";
import type { SubMesh } from "@babylonjs/core/Meshes/subMesh";
import type { Scene } from "@babylonjs/core/scene";

const crystalWeights = new WeakMap<Scene, number>();
const tints: readonly (readonly [number, number, number])[] = [
  [.58, .18, 1], [1, .42, .06], [1, .05, .18], [.08, 1, .46], [.06, .78, 1],
];

export function setPlatformCrystalBlend(scene: Scene, weight: number): void {
  crystalWeights.set(scene, Math.max(0, Math.min(1, weight)));
}

/** Location color grading preserves the atlas facets, alpha, animation and type cues. */
export class PlatformCrystalSkin extends MaterialPluginBase {
  public constructor(material: StandardMaterial) {
    super(material, "PlatformCrystalSkin", 210, {}, true, false);
    this.registerForExtraEvents = true;
    this._enable(true);
  }
  public override isCompatible(): boolean { return true; }
  public override getUniforms(): { ubo: { name: string; size: number; type: string }[] } {
    return { ubo: [{ name: "platformCrystalTint", size: 4, type: "vec4" }] };
  }
  public override hardBindForSubMesh(buffer: UniformBuffer, scene: Scene, _engine: AbstractEngine, subMesh: SubMesh): void {
    const row = (subMesh.getMesh().metadata as { row?: number } | null)?.row ?? 0;
    const tint = tints[row] ?? [.58, .18, 1];
    buffer.updateFloat4("platformCrystalTint", tint[0], tint[1], tint[2], crystalWeights.get(scene) ?? 0);
  }
  public override getCustomCode(shaderType: string, language = ShaderLanguage.GLSL): Record<string, string> | null {
    if (shaderType !== "fragment") return null;
    const wgsl = language === ShaderLanguage.WGSL;
    const v3 = wgsl ? "vec3f" : "vec3";
    const tint = wgsl ? "uniforms.platformCrystalTint" : "platformCrystalTint";
    const scalar = (name: string, expression: string): string => `${wgsl ? "let" : "float"} ${name} = ${expression};`;
    return { CUSTOM_FRAGMENT_UPDATE_DIFFUSE: `
      ${scalar("crystalLum", `dot(baseColor.rgb,${v3}(0.2126,0.7152,0.0722))`)}
      ${scalar("crystalFacet", "pow(clamp(crystalLum,0.0,1.0),0.54)")}
      ${scalar("crystalRim", "pow(max(max(baseColor.r,baseColor.g),baseColor.b),3.0)")}
      ${wgsl ? "let" : "vec3"} crystalColor = ${tint}.rgb*(crystalFacet*0.85+crystalRim*0.32)+baseColor.rgb*0.55;
      baseColor = ${wgsl ? "vec4f" : "vec4"}(mix(baseColor.rgb,crystalColor,${tint}.a),baseColor.a);
    ` };
  }
}
