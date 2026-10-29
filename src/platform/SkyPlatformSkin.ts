import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { VertexBuffer } from "@babylonjs/core/Buffers/buffer";
import { ShaderMaterial } from "@babylonjs/core/Materials/shaderMaterial";
import type { Scene } from "@babylonjs/core/scene";
import type { ApproachState } from "./PlatformReadability";
import type { SkyPlatformAppearance } from "./SkyPlatformAppearance";
import { platformSpriteRow } from "./PlatformSpriteLayout";
import { getPlatformCrystalBlend, getPlatformCrystalTint } from "./PlatformCrystalSkin";

// Shadow, face and luminous edge sampled from the ordinary atlas, including its
// orange/red approach states. Both organic shapes share this one color ramp.
const palettes = [
 [[.012,.075,.224],[0,.318,.871],[.337,.96,1]],
 [[.09,.018,.06],[.72,.10,.035],[1,.64,.06]],
 [[.09,.008,.035],[.78,.025,.08],[1,.34,.39]],
] as const;
function paletteForRow(row:number){return palettes[row]??palettes[0];}

const vertex=`precision highp float;
attribute vec3 position;attribute vec2 uv;uniform mat4 worldViewProjection;varying vec2 vUV;
void main(){vUV=uv;gl_Position=worldViewProjection*vec4(position,1.0);}`;
const fragment=`precision highp float;
varying vec2 vUV;uniform vec4 skyParams;uniform vec4 skyCue;uniform vec4 skyGrade;
uniform vec3 skyShadow;uniform vec3 skyFace;uniform vec3 skyEdge;
vec3 surfaceColor(float light){return mix(skyShadow,skyFace,clamp(light,0.0,1.0));}
float ellipse(vec2 p,vec2 c,vec2 r){return (length((p-c)/r)-1.0)*min(r.x,r.y);}
float puff(vec2 p,float w){
 float d=ellipse(p,vec2(0.0,-.13),vec2(w*.46,.32));
 d=min(d,ellipse(p,vec2(-w*.32,-.08),vec2(w*.19,.36)));
 d=min(d,ellipse(p,vec2(-w*.10,.10),vec2(w*.23,.45)));
 d=min(d,ellipse(p,vec2(w*.17,.02),vec2(w*.20,.48)));
 return min(d,ellipse(p,vec2(w*.36,-.08),vec2(w*.15,.30)));
}
void main(){
 vec2 p=(vUV-.5)*skyParams.xy;float style=skyParams.z;float opacity=skyParams.w;
 vec3 color;float alpha;
 if(style<.5){
  float d=puff(p,skyParams.x*.86);
  float edge=1.0-smoothstep(-.012,.045,d);
  float soft=exp(-max(d,0.0)*15.0)*.32;
  float light=clamp(.36+p.y*.85-p.x/max(1.0,skyParams.x)*.17,0.0,1.0);
  color=surfaceColor(light);
  color=mix(color,mix(skyFace,skyEdge,.15),exp(-abs(d+.12)*8.0)*max(0.0,p.y+.2)*.55);
  color=mix(color,skyEdge,exp(-abs(d)*62.0)*.95);
  if(d>0.0)color=mix(skyFace,skyEdge,exp(-d*30.0));
  alpha=max(edge*.97,soft);
 }else if(style<1.5){
  vec2 q=p/vec2(skyParams.x*.43,min(1.3,max(.6,skyParams.x*.32)));float r=length(q);
  float inside=1.0-smoothstep(.97,1.015,r);
  float rim=exp(-abs(r-.97)*45.0);
  float outer=exp(-abs(r-.99)*12.0)*.32;
  float shine=exp(-pow((r-.85)*35.0,2.0))*smoothstep(.05,.6,q.y)*(1.0-smoothstep(-.7,.3,q.x));
  float dotLight=exp(-dot((q-vec2(-.45,.45))*vec2(10.0,7.0),(q-vec2(-.45,.45))*vec2(10.0,7.0)));
  float water=exp(-abs(q.y+.30+sin(q.x*5.0+skyCue.w)*.035)*55.0)*inside;
  color=surfaceColor(clamp(.30+q.y*.34,0.0,1.0));
  color=mix(color,skyFace,water*.65);
  color=mix(color,skyEdge,clamp(shine+dotLight+rim*.95,0.0,1.0));
  if(r>1.0)color=mix(skyFace,skyEdge,exp(-(r-1.0)*20.0));
  alpha=max(inside*.88,max(rim*.98,max(outer,shine*.95+dotLight*.9)))+water*.12;
 }else{
  vec2 q=(vUV-.5)*2.0;float d=length(q*vec2(1.0,.87));
  float edge=1.0-smoothstep(.72,.98,d);
  color=surfaceColor(clamp(.55+q.y*.35-q.x*.25,0.0,1.0));
  color=mix(color,skyEdge,exp(-abs(d-.78)*22.0)*.75);
  alpha=edge*.85;
 }
 // A slim cue at the actual collision surface preserves the ! / BOOST reading.
 if(style<1.5){float top=style<.5?.55:min(1.3,max(.6,skyParams.x*.32));float rim=exp(-abs(p.y-top)*70.0)*(1.0-smoothstep(skyParams.x*.36,skyParams.x*.42,abs(p.x)));color=mix(color,skyCue.rgb,rim*.8);alpha=max(alpha,rim*.7);}
 // Match PlatformCrystalSkin's grading equation after surface color and highlights.
 float crystalLum=dot(color,vec3(.2126,.7152,.0722));
 float crystalFacet=pow(clamp(crystalLum,0.0,1.0),.54);
 float crystalRim=pow(max(max(color.r,color.g),color.b),3.0);
 color=mix(color,skyGrade.rgb*(crystalFacet*.85+crystalRim*.32)+color*.55,skyGrade.a);
 gl_FragColor=vec4(color,clamp(alpha*opacity,0.0,1.0));
}`;
interface SkyUniforms {width:number;height:number;style:number;opacity:number;cue:readonly [number,number,number];time:number;row:number}
const materials=new WeakMap<Scene,ShaderMaterial>();
export function prepareSkyPlatformSkin(scene:Scene):ShaderMaterial {
 const cached=materials.get(scene);if(cached)return cached;
 const material=new ShaderMaterial("SkyPlatformMaterial",scene,{vertexSource:vertex,fragmentSource:fragment},{
  attributes:["position","uv"],uniforms:["worldViewProjection","skyParams","skyCue","skyShadow","skyFace","skyEdge","skyGrade"],needAlphaBlending:true,
 });
 material.backFaceCulling=false;material.disableDepthWrite=true;
 material.onBindObservable.add(mesh=>{
  const data=(mesh.metadata as {sky?:SkyUniforms}|null)?.sky;if(!data)return;
  const effect=material.getEffect();effect.setFloat4("skyParams",data.width,data.height,data.style,data.opacity);
  effect.setFloat4("skyCue",data.cue[0],data.cue[1],data.cue[2],data.time);
  const palette=paletteForRow(data.row),tint=getPlatformCrystalTint(data.row);
  effect.setFloat3("skyShadow",palette[0][0],palette[0][1],palette[0][2]);
  effect.setFloat3("skyFace",palette[1][0],palette[1][1],palette[1][2]);
  effect.setFloat3("skyEdge",palette[2][0],palette[2][1],palette[2][2]);
  effect.setFloat4("skyGrade",tint[0],tint[1],tint[2],getPlatformCrystalBlend(scene));
 });
 materials.set(scene,material);material.onDisposeObservable.addOnce(()=>materials.delete(scene));return material;
}

/** Two meshes per used pool slot, no particle emitters or textures. */
export class SkyPlatformSkin {
 public readonly body:Mesh;
 public readonly splash:Mesh;
 readonly #positions=new Float32Array(10*4*3);
 readonly #bodyData:SkyUniforms={width:3,height:2.4,style:0,opacity:1,cue:palettes[0][2],time:0,row:0};
 readonly #splashData:SkyUniforms={width:1,height:1,style:2,opacity:0,cue:palettes[0][2],time:0,row:0};
 #appearance:SkyPlatformAppearance="cloud";
 #width=3;#impactAt=-Infinity;#force=1;#reduced=false;#contactX=0;
 public constructor(private readonly parent:Mesh,private readonly height:number,depth:number,scene:Scene){
  this.body=MeshBuilder.CreatePlane(`${parent.name}-sky-body`,{size:1},scene);
  this.splash=new Mesh(`${parent.name}-water-splash`,scene);
  const uvs:number[]=[],indices:number[]=[];
  for(let i=0;i<10;i++){uvs.push(0,0,1,0,1,1,0,1);const n=i*4;indices.push(n,n+1,n+2,n,n+2,n+3);}
  const data=new VertexData();data.positions=this.#positions;data.uvs=uvs;data.indices=indices;data.applyToMesh(this.splash,true);
  this.body.metadata={sky:this.#bodyData};this.splash.metadata={sky:this.#splashData};
  for(const mesh of [this.body,this.splash]){mesh.parent=parent;mesh.material=prepareSkyPlatformSkin(scene);mesh.isPickable=false;mesh.position.z=-depth/2-.075;mesh.setEnabled(false);}
 }
 public reset():void{this.#impactAt=-Infinity;this.#contactX=0;this.hide();}
 public hide():void{this.body.setEnabled(false);this.splash.setEnabled(false);}
 public impact(elapsed:number,force=1,contactX=0):void{this.#impactAt=elapsed;this.#force=Math.max(.7,Math.min(1.6,force));this.#contactX=Math.max(-this.#width/2,Math.min(this.#width/2,contactX));}
 public render(appearance:SkyPlatformAppearance,width:number,state:ApproachState|null,elapsed:number,reduced:boolean):void{
  this.#appearance=appearance;this.#width=width;this.#reduced=reduced;
  this.#bodyData.width=width+.35;this.#bodyData.style=appearance==="cloud"?0:1;
  this.#bodyData.height=appearance==="cloud"?2.4:Math.max(2.4,Math.min(4,(width+.35)*.9));
  const row=platformSpriteRow("standard",state);
  this.#bodyData.row=row;this.#splashData.row=row;
  this.#bodyData.cue=paletteForRow(row)[2];
  this.#bodyData.time=reduced?0:elapsed*2;
  this.#renderContact(Math.max(0,elapsed-this.#impactAt),false);
 }
 public renderBreak(progress:number):void{this.#renderContact(Math.max(0,Math.min(1,progress))*.48,true);}
 #renderContact(age:number,breaking:boolean):void{
  const cloud=this.#appearance==="cloud",active=Number.isFinite(age)&&age<.65;
  const t=Math.min(1,age/.48),envelope=active?Math.sin(Math.min(1,age/.48)*Math.PI)*this.#force:0;
  const motion=this.#reduced ? .25 : 1;
  const inflate=cloud?envelope:envelope*.16;
  this.body.setEnabled(true);
  this.#bodyData.opacity=breaking?(cloud?1-Math.max(0,(t-.22)/.78):1-Math.min(1,t*3)):1;
  this.body.scaling.set((this.#width+.35)/this.parent.scaling.x*(1+inflate*.22*motion),this.#bodyData.height*(1+inflate*.40*motion),1);
  this.body.position.y=this.height/2-(cloud ? .55 : Math.min(1.3,Math.max(.6,this.#bodyData.width*.32)));
  this.#splashData.opacity=active&&!cloud?(1-Math.min(1,age/.60)):0;
  this.splash.setEnabled(this.#splashData.opacity>0);
  if(this.#splashData.opacity<=0)return;
  this.splash.scaling.set(1/this.parent.scaling.x,1,1);
  const count=this.#reduced?4:10;
  for(let i=0;i<10;i++){
   const direction=i%2===0?-1:1,band=Math.floor(i/2),s=age;
   const x=this.#contactX+direction*(.12+band*.16+s*(1.4+band*.65))*motion;
   const y=this.height/2+.1+s*(2.5+(band%3)*.9)*motion-s*s*5.2*motion;
   const radius=i<count ? .065+(i%3)*.027 : 0,stretch=1+Math.min(1.2,s*2);
   const halfX=radius/stretch,halfY=radius*stretch;
   const coords=[x-halfX,y-halfY,0,x+halfX,y-halfY,0,x+halfX,y+halfY,0,x-halfX,y+halfY,0];
   this.#positions.set(coords,i*12);
  }
  this.splash.updateVerticesData(VertexBuffer.PositionKind,this.#positions);this.splash.refreshBoundingInfo();
 }
}
