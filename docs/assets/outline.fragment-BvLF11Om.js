import{S as e,v as r,w as o,x as l,y as d}from"./index-sxoYZAhb.js";const n="outlinePixelShader",i=`#ifdef LOGARITHMICDEPTH
#extension GL_EXT_frag_depth : enable
#endif
uniform vec4 color;
#ifdef ALPHATEST
varying vec2 vUV;uniform sampler2D diffuseSampler;
#endif
#include<clipPlaneFragmentDeclaration>
#include<logDepthDeclaration>
#define CUSTOM_FRAGMENT_DEFINITIONS
void main(void) {
#define CUSTOM_FRAGMENT_MAIN_BEGIN
#include<clipPlaneFragment>
#ifdef ALPHATEST
if (texture2D(diffuseSampler,vUV).a<0.4)
discard;
#endif
#include<logDepthFragment>
gl_FragColor=color;
#define CUSTOM_FRAGMENT_MAIN_END
}`;e.ShadersStore[n]||(e.ShadersStore[n]=i);const t=[r,o,l,d];for(const a of t)e.IncludesShadersStore[a.name]||(e.IncludesShadersStore[a.name]=a.shader);const f={name:n,shader:i};export{f as outlinePixelShader};
//# sourceMappingURL=outline.fragment-BvLF11Om.js.map
