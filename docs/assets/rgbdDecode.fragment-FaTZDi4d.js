import{S as e,ah as n}from"./index-Dt8VD6g8.js";const o="rgbdDecodePixelShader",a=`varying vec2 vUV;uniform sampler2D textureSampler;
#include<helperFunctions>
#define CUSTOM_FRAGMENT_DEFINITIONS
void main(void) 
{gl_FragColor=vec4(fromRGBD(texture2D(textureSampler,vUV)),1.0);}`;e.ShadersStore[o]||(e.ShadersStore[o]=a);const d=[n];for(const r of d)e.IncludesShadersStore[r.name]||(e.IncludesShadersStore[r.name]=r.shader);const s={name:o,shader:a};export{s as rgbdDecodePixelShader};
//# sourceMappingURL=rgbdDecode.fragment-FaTZDi4d.js.map
