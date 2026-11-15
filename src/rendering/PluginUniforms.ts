import type { Material } from "@babylonjs/core/Materials/material";
import { ShaderLanguage } from "@babylonjs/core/Materials/shaderLanguage";
interface PluginUniform { name: string; size: number; type: string }

/** WebGL1 and driver-blacklisted WebGL2 browsers do not inject UBO members. */
export function pluginUniforms(material: Material, ubo: PluginUniform[]): { ubo: PluginUniform[]; fragment: string } {
  return { ubo, fragment: material.shaderLanguage === ShaderLanguage.WGSL || material.getScene().getEngine().supportsUniformBuffers
    ? "" : ubo.map(uniform => `uniform ${uniform.type} ${uniform.name};`).join("\n") };
}
