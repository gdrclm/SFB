import{S as e}from"./index-CXVQ8Zfq.js";import{h as n}from"./helperFunctions-Cfy9eoVp.js";const t="rgbdDecodePixelShader",a=`varying vUV: vec2f;var textureSamplerSampler: sampler;var textureSampler: texture_2d<f32>;
#include<helperFunctions>
#define CUSTOM_FRAGMENT_DEFINITIONS
@fragment
fn main(input: FragmentInputs)->FragmentOutputs {fragmentOutputs.color=vec4f(fromRGBD(textureSample(textureSampler,textureSamplerSampler,input.vUV)),1.0);}`;e.ShadersStoreWGSL[t]||(e.ShadersStoreWGSL[t]=a);const S=[n];for(const r of S)e.IncludesShadersStoreWGSL[r.name]||(e.IncludesShadersStoreWGSL[r.name]=r.shader);const m={name:t,shader:a};export{m as rgbdDecodePixelShaderWGSL};
//# sourceMappingURL=rgbdDecode.fragment-C3JbrNAJ.js.map
