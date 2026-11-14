import {MaterialPluginBase} from "@babylonjs/core/Materials/materialPluginBase";
import {ShaderLanguage} from "@babylonjs/core/Materials/shaderLanguage";
import type {StandardMaterial} from "@babylonjs/core/Materials/standardMaterial";
import type {UniformBuffer} from "@babylonjs/core/Materials/uniformBuffer";
import type {AbstractEngine} from "@babylonjs/core/Engines/abstractEngine";
import type {SubMesh} from "@babylonjs/core/Meshes/subMesh";
import type {Scene} from "@babylonjs/core/scene";

/** Per-platform sharp cracks and a small delayed-rupture hole on the idle art. */
export class PlatformImpactSkin extends MaterialPluginBase {
 public constructor(material:StandardMaterial){super(material,"PlatformImpactSkin",205,{},true,false);this.registerForExtraEvents=true;this._enable(true);}
 public override isCompatible(language:ShaderLanguage):boolean{return language===ShaderLanguage.GLSL;}
 public override getUniforms(){return{ubo:[{name:"platformImpact",size:4,type:"vec4"}]};}
 public override hardBindForSubMesh(buffer:UniformBuffer,_scene:Scene,_engine:AbstractEngine,subMesh:SubMesh):void{
  const data=subMesh.getMesh().metadata as {impactX?:number;impactY?:number;impactCrack?:number;impactHole?:number}|null;
  buffer.updateFloat4("platformImpact",data?.impactX??0,data?.impactY??0,data?.impactCrack??0,data?.impactHole??0);
 }
 public override getCustomCode(type:string):Record<string,string>|null{
  if(type!=="fragment")return null;
  return{CUSTOM_FRAGMENT_UPDATE_DIFFUSE:`
   if(platformImpact.z>0.0){
    vec2 ip=vec2(vPositionW.x-platformImpact.x,platformImpact.y-vPositionW.y);
    float reach=smoothstep(-.02,.04,ip.y)*(1.0-smoothstep(.45+platformImpact.z*.8,.55+platformImpact.z*.8,length(ip)));
    float jag=sin(ip.y*27.0)*.025+sin(ip.y*61.0)*.012;
    float crack=min(abs(ip.x-ip.y*.43-jag),min(abs(ip.x+ip.y*.65-jag),abs(ip.x*.8-ip.y*.07+jag)));
    float seam=(1.0-smoothstep(.012,.026,crack))*reach*platformImpact.z;
    baseColor.rgb=mix(baseColor.rgb,vec3(.018,.035,.09),seam*.92);
    baseColor.rgb+=vec3(.35,.78,1.0)*exp(-abs(crack-.032)*100.0)*reach*platformImpact.z*.22;
    float hole=1.0-smoothstep(.78,1.05,length(vec2(ip.x/.30,(ip.y-.25)/.80)));
    alpha*=1.0-hole*platformImpact.w;
   }
  `};
 }
}
