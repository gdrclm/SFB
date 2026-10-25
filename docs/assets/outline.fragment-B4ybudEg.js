import{S as e}from"./index-KuOsGKDo.js";import{c as t,a as i}from"./clipPlaneFragment-Cx1j5dgk.js";import{l}from"./logDepthDeclaration-Bg1WebaO.js";import{l as o}from"./logDepthFragment-C618Whdu.js";const a="outlinePixelShader",n=`uniform color: vec4f;
#ifdef ALPHATEST
varying vUV: vec2f;var diffuseSamplerSampler: sampler;var diffuseSampler: texture_2d<f32>;
#endif
#include<clipPlaneFragmentDeclaration>
#include<logDepthDeclaration>
#define CUSTOM_FRAGMENT_DEFINITIONS
@fragment
fn main(input: FragmentInputs)->FragmentOutputs {
#define CUSTOM_FRAGMENT_MAIN_BEGIN
#include<clipPlaneFragment>
#ifdef ALPHATEST
if (textureSample(diffuseSampler,diffuseSamplerSampler,fragmentInputs.vUV).a<0.4) {discard;}
#endif
#include<logDepthFragment>
fragmentOutputs.color=uniforms.color;
#define CUSTOM_FRAGMENT_MAIN_END
}`;e.ShadersStoreWGSL[a]||(e.ShadersStoreWGSL[a]=n);const f=[t,l,i,o];for(const r of f)e.IncludesShadersStoreWGSL[r.name]||(e.IncludesShadersStoreWGSL[r.name]=r.shader);const c={name:a,shader:n};export{c as outlinePixelShaderWGSL};
//# sourceMappingURL=outline.fragment-B4ybudEg.js.map
