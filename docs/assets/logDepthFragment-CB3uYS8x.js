import{S as e}from"./index-DZU9mttQ.js";const t="logDepthFragment",r=`#ifdef LOGARITHMICDEPTH
fragmentOutputs.fragDepth=log2(fragmentInputs.vFragmentDepth)*uniforms.logarithmicDepthConstant*0.5;
#endif
`;e.IncludesShadersStoreWGSL[t]||(e.IncludesShadersStoreWGSL[t]=r);const a={name:t,shader:r};export{a as l};
//# sourceMappingURL=logDepthFragment-CB3uYS8x.js.map
