import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { VertexBuffer } from "@babylonjs/core/Buffers/buffer";
import { ShaderMaterial } from "@babylonjs/core/Materials/shaderMaterial";
import type { Scene } from "@babylonjs/core/scene";
import type { ApproachState } from "./PlatformReadability";
import type { SkyPlatformAppearance } from "./SkyPlatformAppearance";

const vertex=`precision highp float;
attribute vec3 position;attribute vec2 uv;uniform mat4 worldViewProjection;varying vec2 vUV;
void main(){vUV=uv;gl_Position=worldViewProjection*vec4(position,1.0);}`;
const fragment=`precision highp float;
varying vec2 vUV;uniform vec4 skyParams;uniform vec4 skyCue;
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
  float soft=exp(-max(d,0.0)*21.0)*.16;
  float light=clamp(.55+p.y*.65-p.x/max(1.0,skyParams.x)*.17,0.0,1.0);
  color=mix(vec3(.23,.59,.95),vec3(.94,.99,1.0),light);
  color+=vec3(.12,.15,.15)*exp(-abs(d+.10)*8.0)*max(0.0,p.y+.2);
  color=mix(color,vec3(.035,.38,.94),exp(-abs(d+.01)*50.0)*.65);
  alpha=max(edge*.97,soft);
 }else if(style<1.5){
  vec2 q=p/vec2(skyParams.x*.43,min(1.3,max(.6,skyParams.x*.32)));float r=length(q);
  float inside=1.0-smoothstep(.97,1.015,r);
  float rim=exp(-abs(r-.97)*45.0);
  float outer=exp(-abs(r-.99)*12.0)*.18;
  float shine=exp(-pow((r-.85)*35.0,2.0))*smoothstep(.05,.6,q.y)*(1.0-smoothstep(-.7,.3,q.x));
  float dotLight=exp(-dot((q-vec2(-.45,.45))*vec2(10.0,7.0),(q-vec2(-.45,.45))*vec2(10.0,7.0)));
  float water=exp(-abs(q.y+.30+sin(q.x*5.0+skyCue.w)*.035)*55.0)*inside;
  color=mix(vec3(.08,.48,1.0),vec3(.55,.96,1.0),clamp(.5+q.y*.4,0.0,1.0));
  color=mix(color,vec3(.96,1.0,1.0),clamp(shine+dotLight+rim*.4,0.0,1.0));
  alpha=max(inside*.15,max(rim*.9,max(outer,shine*.95+dotLight*.9)))+water*.23;
 }else{
  vec2 q=(vUV-.5)*2.0;float d=length(q*vec2(1.0,.87));
  float edge=1.0-smoothstep(.72,.98,d);
  color=mix(vec3(.10,.62,1.0),vec3(.85,1.0,1.0),clamp(.35+q.y*.45-q.x*.25,0.0,1.0));
  alpha=edge*.85;
 }
 // A slim cue at the actual collision surface preserves the ! / BOOST reading.
 if(style<1.5){float top=style<.5?.55:min(1.3,max(.6,skyParams.x*.32));float rim=exp(-abs(p.y-top)*70.0)*(1.0-smoothstep(skyParams.x*.36,skyParams.x*.42,abs(p.x)));color=mix(color,skyCue.rgb,rim*.8);alpha=max(alpha,rim*.7);}
 gl_FragColor=vec4(color,clamp(alpha*opacity,0.0,1.0));
}`;
interface SkyUniforms {width:number;height:number;style:number;opacity:number;cue:readonly [number,number,number];time:number}
const materials=new WeakMap<Scene,ShaderMaterial>();
export function prepareSkyPlatformSkin(scene:Scene):ShaderMaterial {
 const cached=materials.get(scene);if(cached)return cached;
 const material=new ShaderMaterial("SkyPlatformMaterial",scene,{vertexSource:vertex,fragmentSource:fragment},{
  attributes:["position","uv"],uniforms:["worldViewProjection","skyParams","skyCue"],needAlphaBlending:true,
 });
 material.backFaceCulling=false;material.disableDepthWrite=true;
 material.onBindObservable.add(mesh=>{
  const data=(mesh.metadata as {sky?:SkyUniforms}|null)?.sky;if(!data)return;
  const effect=material.getEffect();effect.setFloat4("skyParams",data.width,data.height,data.style,data.opacity);
  effect.setFloat4("skyCue",data.cue[0],data.cue[1],data.cue[2],data.time);
 });
 materials.set(scene,material);material.onDisposeObservable.addOnce(()=>materials.delete(scene));return material;
}

/** Two meshes per used pool slot, no particle emitters or textures. */
export class SkyPlatformSkin {
 public readonly body:Mesh;
 public readonly splash:Mesh;
 readonly #positions=new Float32Array(10*4*3);
 readonly #bodyData:SkyUniforms={width:3,height:2.4,style:0,opacity:1,cue:[.5,.92,1],time:0};
 readonly #splashData:SkyUniforms={width:1,height:1,style:2,opacity:0,cue:[.5,.92,1],time:0};
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
  this.#bodyData.cue=state==="danger"?[1,.2,.36]:state==="boost"?[1,.65,.08]:[.5,.92,1];
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
