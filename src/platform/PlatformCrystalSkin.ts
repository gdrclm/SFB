import { MaterialPluginBase } from "@babylonjs/core/Materials/materialPluginBase";
import { ShaderLanguage } from "@babylonjs/core/Materials/shaderLanguage";
import type { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import type { UniformBuffer } from "@babylonjs/core/Materials/uniformBuffer";
import type { AbstractEngine } from "@babylonjs/core/Engines/abstractEngine";
import type { SubMesh } from "@babylonjs/core/Meshes/subMesh";
import type { Scene } from "@babylonjs/core/scene";

const crystalWeights = new WeakMap<Scene, number>();
const lavaWeights = new WeakMap<Scene, number>();
const tints: readonly (readonly [number, number, number])[] = [
  [.58, .18, 1], [1, .42, .06], [1, .05, .18], [.08, 1, .46], [.06, .78, 1],
];
// Ordinary stone becomes charcoal/copper. Existing state/material rows retain
// their amber, red, green and cyan vocabulary under the warm torchlight.
const lavaTints:readonly (readonly [number,number,number])[]=[
  [.92,.48,.24],[1,.76,.13],[1,.12,.10],[.22,1,.48],[.20,.78,1],
];

export function setPlatformCrystalBlend(scene: Scene, weight: number): void {
  crystalWeights.set(scene, Math.max(0, Math.min(1, weight)));
}

/** Custom surface shaders use the same scene grading as the rock atlas. */
export function getPlatformCrystalBlend(scene: Scene): number { return crystalWeights.get(scene) ?? 0; }
export function getPlatformCrystalTint(row: number): readonly [number, number, number] {
  return tints[row] ?? [.58, .18, 1];
}
export function setPlatformLavaBlend(scene:Scene,weight:number):void{
  lavaWeights.set(scene,Number.isFinite(weight)?Math.max(0,Math.min(1,weight)):0);
}
export function getPlatformLavaBlend(scene:Scene):number{return lavaWeights.get(scene)??0;}
export function getPlatformLavaTint(row:number):readonly [number,number,number]{return lavaTints[row]??lavaTints[0]??[.92,.48,.24];}

/** Location color grading preserves the atlas facets, alpha, animation and type cues. */
export class PlatformCrystalSkin extends MaterialPluginBase {
  public constructor(material: StandardMaterial,private readonly includeCrystal=true) {
    super(material, "PlatformCrystalSkin", 210, {}, true, false);
    this.registerForExtraEvents = true;
    this._enable(true);
  }
  public override isCompatible(): boolean { return true; }
  public override getUniforms(): { ubo: { name: string; size: number; type: string }[] } {
    return { ubo: [{ name: "platformCrystalTint", size: 4, type: "vec4" },{name:"platformLavaTint",size:4,type:"vec4"}] };
  }
  public override hardBindForSubMesh(buffer: UniformBuffer, scene: Scene, _engine: AbstractEngine, subMesh: SubMesh): void {
    const sample = subMesh.getMesh().metadata as { row?: number; previousRow?: number; rowBlend?: number } | null;
    const row = sample?.row ?? 0;
    const tint = tints[row] ?? tints[0];
    const oldTint = tints[sample?.previousRow ?? row] ?? tint;
    const blend = sample?.rowBlend ?? 1;
    if (tint === undefined || oldTint === undefined) return;
    buffer.updateFloat4("platformCrystalTint",
      oldTint[0] + (tint[0] - oldTint[0]) * blend,
      oldTint[1] + (tint[1] - oldTint[1]) * blend,
      oldTint[2] + (tint[2] - oldTint[2]) * blend, this.includeCrystal?(crystalWeights.get(scene)??0):0);
    const lavaTint=getPlatformLavaTint(row),oldLavaTint=getPlatformLavaTint(sample?.previousRow??row);
    buffer.updateFloat4("platformLavaTint",oldLavaTint[0]+(lavaTint[0]-oldLavaTint[0])*blend,
      oldLavaTint[1]+(lavaTint[1]-oldLavaTint[1])*blend,oldLavaTint[2]+(lavaTint[2]-oldLavaTint[2])*blend,getPlatformLavaBlend(scene));
  }
  public override getCustomCode(shaderType: string, language = ShaderLanguage.GLSL): Record<string, string> | null {
    if (shaderType !== "fragment") return null;
    const wgsl = language === ShaderLanguage.WGSL;
    const v3 = wgsl ? "vec3f" : "vec3";
    const tint = wgsl ? "uniforms.platformCrystalTint" : "platformCrystalTint";
    const lava=wgsl?"uniforms.platformLavaTint":"platformLavaTint";
    const scalar = (name: string, expression: string): string => `${wgsl ? "let" : "float"} ${name} = ${expression};`;
    return { CUSTOM_FRAGMENT_UPDATE_DIFFUSE: `
      ${scalar("crystalLum", `dot(baseColor.rgb,${v3}(0.2126,0.7152,0.0722))`)}
      ${scalar("crystalFacet", "pow(clamp(crystalLum,0.0,1.0),0.54)")}
      ${scalar("crystalRim", "pow(max(max(baseColor.r,baseColor.g),baseColor.b),3.0)")}
      ${wgsl ? "let" : "vec3"} crystalColor = ${tint}.rgb*(crystalFacet*0.85+crystalRim*0.32)+baseColor.rgb*0.55;
      baseColor = ${wgsl ? "vec4f" : "vec4"}(mix(baseColor.rgb,crystalColor,${tint}.a),baseColor.a);
      ${scalar("torchLum",`dot(baseColor.rgb,${v3}(0.2126,0.7152,0.0722))`)}
      ${scalar("torchFacet","pow(clamp(torchLum,0.0,1.0),0.65)")}
      ${scalar("torchRim","pow(max(max(baseColor.r,baseColor.g),baseColor.b),3.0)")}
      ${wgsl?"let":"vec3"} torchStone = ${v3}(0.09,0.07,0.06)+${lava}.rgb*(torchFacet*0.48+torchRim*0.30)+baseColor.rgb*0.16;
      baseColor = ${wgsl?"vec4f":"vec4"}(mix(baseColor.rgb,torchStone,${lava}.a),baseColor.a);
    ` };
  }
}
