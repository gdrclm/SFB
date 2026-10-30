import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { VertexBuffer } from "@babylonjs/core/Buffers/buffer";
import { ShaderMaterial } from "@babylonjs/core/Materials/shaderMaterial";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import waterSheetUrl from "../assets/effects/water-sheet.png";
import type { Scene } from "@babylonjs/core/scene";
import type { ApproachState } from "./PlatformReadability";
import type { SkyPlatformAppearance } from "./SkyPlatformAppearance";
import { platformSpriteRow } from "./PlatformSpriteLayout";
import { getPlatformCrystalBlend, getPlatformCrystalTint } from "./PlatformCrystalSkin";
import { WaterSplashGeometry, WATER_SPLASH_SECONDS, WATER_SHEET_COLUMNS, WATER_SHEET_ROWS } from "./WaterSplashGeometry";
import { CloudBurstGeometry, CLOUD_BURST_SECONDS, cloudSplitGap } from "./CloudBurstGeometry";

// Soft icy colors for sky shapes; ordinary orange/red safety cues remain shared.
const palettes = [
 [[.26,.59,.86],[.82,.95,1],[.94,1,1]],
 [[.09,.018,.06],[.72,.10,.035],[1,.64,.06]],
 [[.09,.008,.035],[.78,.025,.08],[1,.34,.39]],
] as const;
function paletteForRow(row:number){return palettes[row]??palettes[0];}

const vertex=`precision highp float;
attribute vec3 position;attribute vec2 uv;attribute vec2 waterData;uniform mat4 worldViewProjection;varying vec2 vUV;varying vec2 vWater;
void main(){vUV=uv;vWater=waterData;gl_Position=worldViewProjection*vec4(position,1.0);}`;
const fragment=`precision highp float;
varying vec2 vUV;varying vec2 vWater;uniform vec4 skyParams;uniform vec4 skyCue;uniform vec4 skyGrade;
uniform vec4 skyCloud;
uniform vec2 skyPress;
uniform sampler2D waterSheetSampler;
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
  float age=max(0.0,skyCue.w),seam=skyCloud.y+sin(p.y*11.0+age*3.0)*.05;
  float side=p.x<seam?-1.0:1.0;
  vec2 cloudPoint=p;cloudPoint.x-=side*skyCloud.z;
  float wave=exp(-pow((abs(cloudPoint.x-skyCloud.y)-age*9.0)/.42,2.0))*exp(-age*2.2)*skyCloud.w;
  cloudPoint.y=(cloudPoint.y-wave*.08)/(1.0+wave*.30);
  float d=puff(cloudPoint,skyCloud.x*.86);
  float edge=1.0-smoothstep(-.02,.065,d);
  float soft=exp(-max(d,0.0)*15.0)*.20;
  float light=clamp(.65+cloudPoint.y*.45-cloudPoint.x/max(1.0,skyCloud.x)*.12+wave*.10,0.0,1.0);
  color=surfaceColor(light);
  color=mix(color,mix(skyFace,skyEdge,.15),exp(-abs(d+.12)*8.0)*max(0.0,p.y+.2)*.55);
  color=mix(color,skyEdge,exp(-abs(d)*40.0)*.5);
  if(d>0.0)color=mix(skyFace,skyEdge,exp(-d*30.0));
  alpha=max(edge*.97,soft);
  float splitEdge=smoothstep(-.035,.035,side*(cloudPoint.x-seam));
  alpha*=mix(1.0,splitEdge,smoothstep(0.0,.06,skyCloud.z));
 }else if(style<1.5){
  vec2 liquidPoint=p;
  liquidPoint.y+=skyPress.y*exp(-pow((p.x-skyPress.x)/.6,2.0))*smoothstep(-.2,.7,p.y);
  vec2 q=liquidPoint/vec2(skyParams.x*.43,min(1.3,max(.6,skyParams.x*.32)));float r=length(q);
  float inside=1.0-smoothstep(.97,1.015,r);
  float rim=exp(-abs(r-.97)*45.0);
  float outer=exp(-abs(r-.99)*12.0)*.32;
  float shine=exp(-pow((r-.85)*35.0,2.0))*smoothstep(.05,.6,q.y)*(1.0-smoothstep(-.7,.3,q.x));
  float dotLight=exp(-dot((q-vec2(-.45,.45))*vec2(10.0,7.0),(q-vec2(-.45,.45))*vec2(10.0,7.0)));
  float water=exp(-abs(q.y+.30+sin(q.x*5.0+skyCue.w)*.035)*55.0)*inside;
  float innerGlow=exp(-dot(q,q)*1.7);
  float innerCore=exp(-dot(q-vec2(0.0,.12),q-vec2(0.0,.12))*5.5);
  color=surfaceColor(clamp(.55+q.y*.20,0.0,1.0));
  color=mix(color,skyFace,innerGlow*.75)+skyEdge*innerCore*.14;
  color=mix(color,skyFace,water*.65);
  color=mix(color,skyEdge,clamp(shine+dotLight+rim*.95,0.0,1.0));
  if(r>1.0)color=mix(skyFace,skyEdge,exp(-(r-1.0)*20.0));
  alpha=max(inside*(.38+innerGlow*.30),max(rim*.98,max(outer,shine*.95+dotLight*.9)))+water*.12;
 }else if(style>2.5){
  vec2 q=(vUV-.5)*vec2(3.6,2.2);
  float d=puff(q,2.8);
  float edge=1.0-smoothstep(-.08,.12,d),haze=exp(-max(d,0.0)*12.0)*.14;
  color=surfaceColor(clamp(.70+q.y*.25-q.x*.07,0.0,1.0));
  float pillows=exp(-dot((q-vec2(-.35,.13))*vec2(2.8,3.7),(q-vec2(-.35,.13))*vec2(2.8,3.7)))
   +exp(-dot((q-vec2(.40,.10))*vec2(3.4,4.0),(q-vec2(.40,.10))*vec2(3.4,4.0)));
  color=mix(color,skyEdge,clamp(pillows*.25,0.0,.4));
  color=mix(color,skyEdge,exp(-abs(d+.08)*14.0)*.25);
  alpha=max(edge*.85,haze)*vWater.y;
 }else{
  vec2 q=(vUV-.5)*2.0;
  if(vWater.x>1.5){
   vec2 liquidUV=vUV;
   float bend=smoothstep(.20,.85,liquidUV.y)*sin(liquidUV.y*8.0+skyCue.w*10.0)*.018;
   liquidUV.x+=bend;
   vec4 liquid=texture2D(waterSheetSampler,liquidUV);
   // Jittered Voronoi regions let water separate into organic pieces instead
   // of revealing the rectangular geometry used by the fixed particle batch.
   vec2 grid=vec2(${String(WATER_SHEET_COLUMNS)}.0,${String(WATER_SHEET_ROWS)}.0),point=vUV*grid;
   vec2 tile=floor(point),cell=tile,seedPoint=point;float nearest=100.0;
   for(int cy=-1;cy<=1;cy++)for(int cx=-1;cx<=1;cx++){
    vec2 candidate=tile+vec2(float(cx),float(cy));
    if(candidate.x<0.0||candidate.y<0.0||candidate.x>=grid.x||candidate.y>=grid.y)continue;
    vec2 jitter=(vec2(mod(candidate.x*3.0+candidate.y*5.0,11.0)/10.0,mod(candidate.x*5.0+candidate.y*3.0,13.0)/12.0)-.5)*.55;
    float distance=length(point-candidate-.5-jitter);
    if(distance<nearest){nearest=distance;cell=candidate;seedPoint=candidate+.5+jitter;}
   }
   float seed=mod(cell.x*7.0+cell.y*13.0,17.0)/16.0;
   float handoff=.30+seed*.20;
   float connected=vWater.x<2.5?1.0-smoothstep(handoff,handoff+.08,skyCue.w):1.0;
   color=liquid.rgb;
   alpha=smoothstep(.04,.20,liquid.a)*vWater.y*connected;
   if(vWater.x>2.5){
    float id=floor(vWater.x-3.0),phase=fract(vWater.x-3.0)/.49;
    vec2 owner=vec2(mod(id,grid.x),floor(id/grid.x));
    float owned=1.0-step(.1,length(cell-owner));
    float morph=smoothstep(.06,.45,phase);
    float radius=mix(1.6,.38,smoothstep(0.0,.50,phase));
    float bead=1.0-smoothstep(radius*.75,radius,nearest);
    vec2 beadUV=(point-seedPoint)/radius;
    vec3 beadColor=mix(vec3(.16,.65,.80),vec3(.72,.96,1.0),clamp(.65+beadUV.y*.20-beadUV.x*.35,0.0,1.0));
    float glint=exp(-dot((beadUV-vec2(-.28,.32))*5.0,(beadUV-vec2(-.28,.32))*5.0));
    beadColor=mix(beadColor,vec3(.96,1.0,1.0),glint);
    float seedWater=smoothstep(.04,.20,texture2D(waterSheetSampler,seedPoint/grid).a);
    color=mix(color,beadColor,morph);
    alpha=mix(alpha,seedWater*bead*vWater.y,morph);
    float inImage=step(0.0,vUV.x)*step(vUV.x,1.0)*step(0.0,vUV.y)*step(vUV.y,1.0);
    alpha*=owned*bead*inImage;
   }
  }else if(vWater.x<.5){
   float d=length((q-vec2(0.0,.25))/vec2(.72,.60));
   float head=1.0-smoothstep(.82,1.0,d);
   float width=.06+.42*smoothstep(-.95,.20,q.y);
   float tail=(1.0-smoothstep(width*.6,width,abs(q.x)))*(1.0-smoothstep(.1,.35,q.y))*smoothstep(-1.0,-.85,q.y);
   float glint=exp(-dot((q-vec2(-.21,.43))*vec2(9.0,8.0),(q-vec2(-.21,.43))*vec2(9.0,8.0)));
   color=mix(vec3(.10,.56,.72),vec3(.62,.94,1.0),clamp(.65+q.y*.15-q.x*.3,0.0,1.0));
   float reflection=exp(-pow((d-.72)*13.0,2.0))*(1.0-smoothstep(-.1,.45,q.x))*smoothstep(.1,.65,q.y);
   color=mix(color,vec3(.96,1.0,1.0),clamp(glint+reflection,0.0,1.0));
   alpha=max(head,tail*.65)*vWater.y;
  }else{
   float edge=1.0-smoothstep(.45,1.0,abs(q.x));
   float core=pow(max(0.0,1.0-abs(q.x)),2.0);
   color=mix(skyShadow,skyEdge,.25+core*.75);
   alpha=edge*vWater.y;
  }
 }
 // A slim cue at the actual collision surface preserves the ! / BOOST reading.
 if(style<1.5){float top=style<.5?.55:min(1.3,max(.6,skyParams.x*.32));float cueY=p.y;if(style>.5)cueY+=skyPress.y*exp(-pow((p.x-skyPress.x)/.6,2.0))*smoothstep(-.2,.7,p.y);float rim=exp(-abs(cueY-top)*70.0)*(1.0-smoothstep(skyParams.x*.36,skyParams.x*.42,abs(p.x)));if(style<.5)rim*=1.0-smoothstep(0.0,.12,skyCloud.z);color=mix(color,skyCue.rgb,rim*.8);alpha=max(alpha,rim*.7);}
 // Match PlatformCrystalSkin's grading equation after surface color and highlights.
 float crystalLum=dot(color,vec3(.2126,.7152,.0722));
 float crystalFacet=pow(clamp(crystalLum,0.0,1.0),.54);
 float crystalRim=pow(max(max(color.r,color.g),color.b),3.0);
 color=mix(color,skyGrade.rgb*(crystalFacet*.85+crystalRim*.32)+color*.55,skyGrade.a);
 gl_FragColor=vec4(color,clamp(alpha*opacity,0.0,1.0));
}`;
interface SkyUniforms {width:number;height:number;style:number;opacity:number;cue:readonly [number,number,number];time:number;row:number;cloudWidth?:number;contactX?:number;splitGap?:number;waveForce?:number;pressX?:number;pressDepth?:number}
const materials=new WeakMap<Scene,ShaderMaterial>();
const sheetTextures=new WeakMap<Scene,Texture>();
export function waterSplashTexture(scene:Scene):Texture{
 const cached=sheetTextures.get(scene);if(cached)return cached;
 const texture=new Texture(waterSheetUrl,scene,true,true,Texture.BILINEAR_SAMPLINGMODE);
 texture.name="WaterSplashSheet";texture.hasAlpha=true;
 texture.wrapU=texture.wrapV=Texture.CLAMP_ADDRESSMODE;
 sheetTextures.set(scene,texture);texture.onDisposeObservable.addOnce(()=>sheetTextures.delete(scene));return texture;
}
export function prepareSkyPlatformSkin(scene:Scene):ShaderMaterial {
 const cached=materials.get(scene);if(cached)return cached;
 const material=new ShaderMaterial("SkyPlatformMaterial",scene,{vertexSource:vertex,fragmentSource:fragment},{
  attributes:["position","uv","waterData"],uniforms:["worldViewProjection","skyParams","skyCue","skyShadow","skyFace","skyEdge","skyGrade","skyCloud","skyPress"],needAlphaBlending:true,
  samplers:["waterSheetSampler"],
 });
 material.setTexture("waterSheetSampler",waterSplashTexture(scene));
 material.backFaceCulling=false;material.disableDepthWrite=true;
 material.onBindObservable.add(mesh=>{
  const data=(mesh.metadata as {sky?:SkyUniforms}|null)?.sky;if(!data)return;
  const effect=material.getEffect();effect.setFloat4("skyParams",data.width,data.height,data.style,data.opacity);
  effect.setFloat4("skyCue",data.cue[0],data.cue[1],data.cue[2],data.time);
  effect.setFloat4("skyCloud",data.cloudWidth??data.width,data.contactX??0,data.splitGap??0,data.waveForce??0);
  effect.setFloat2("skyPress",data.pressX??0,data.pressDepth??0);
  const palette=paletteForRow(data.row),tint=getPlatformCrystalTint(data.row);
  effect.setFloat3("skyShadow",palette[0][0],palette[0][1],palette[0][2]);
  effect.setFloat3("skyFace",palette[1][0],palette[1][1],palette[1][2]);
  effect.setFloat3("skyEdge",palette[2][0],palette[2][1],palette[2][2]);
  effect.setFloat4("skyGrade",tint[0],tint[1],tint[2],getPlatformCrystalBlend(scene));
 });
 materials.set(scene,material);material.onDisposeObservable.addOnce(()=>materials.delete(scene));return material;
}

/** Shared material, with a lazy fixed puff batch for slots that display clouds. */
export class SkyPlatformSkin {
 public readonly body:Mesh;
 public readonly splash:Mesh;
 readonly #water=new WaterSplashGeometry();
 readonly #cloud=new CloudBurstGeometry();
 #mist:Mesh|null=null;
 readonly #mistData:SkyUniforms={width:1,height:1,style:3,opacity:0,cue:palettes[0][2],time:0,row:0};
 readonly #bodyData:SkyUniforms={width:3,height:2.4,style:0,opacity:1,cue:palettes[0][2],time:0,row:0};
 readonly #splashData:SkyUniforms={width:1,height:1,style:2,opacity:0,cue:palettes[0][2],time:0,row:0};
 #appearance:SkyPlatformAppearance="cloud";
 #width=3;#impactAt=-Infinity;#force=1;#reduced=false;#contactX=0;
 public constructor(private readonly parent:Mesh,private readonly height:number,depth:number,scene:Scene){
  this.body=MeshBuilder.CreatePlane(`${parent.name}-sky-body`,{size:1},scene);
  this.body.setVerticesData("waterData",[0,1,0,1,0,1,0,1],false,2);
  this.splash=new Mesh(`${parent.name}-water-splash`,scene);
  const data=new VertexData();data.positions=this.#water.positions;data.uvs=this.#water.uvs;data.indices=this.#water.indices;data.applyToMesh(this.splash,true);
  this.splash.setVerticesData("waterData",this.#water.waterData,true,2);
  this.body.metadata={sky:this.#bodyData};this.splash.metadata={sky:this.#splashData};
  for(const mesh of [this.body,this.splash]){mesh.parent=parent;mesh.material=prepareSkyPlatformSkin(scene);mesh.isPickable=false;mesh.position.z=-depth/2-.075;mesh.setEnabled(false);}
 }
 public get cloudBurst():Mesh|null{return this.#mist;}
 public reset():void{this.#impactAt=-Infinity;this.#contactX=0;this.hide();}
 public hide():void{this.body.setEnabled(false);this.splash.setEnabled(false);this.#mist?.setEnabled(false);}
 public impact(elapsed:number,force=1,contactX=0):void{this.#impactAt=elapsed;this.#force=Math.max(.7,Math.min(1.6,force));this.#contactX=Math.max(-this.#width/2,Math.min(this.#width/2,contactX));}
 public render(appearance:SkyPlatformAppearance,width:number,state:ApproachState|null,elapsed:number,reduced:boolean):void{
  this.#bodyData.pressDepth=0;
  this.#appearance=appearance;this.#width=width;this.#reduced=reduced;
  this.#bodyData.width=width+.35;this.#bodyData.style=appearance==="cloud"?0:1;
  this.#bodyData.height=appearance==="cloud"?2.4:Math.max(2.4,Math.min(4,(width+.35)*.9));
  const row=platformSpriteRow("standard",state);
  this.#bodyData.row=row;this.#splashData.row=0;
  this.#bodyData.cue=paletteForRow(row)[2];
  this.#bodyData.time=reduced?0:elapsed*2;
  this.#renderContact(Math.max(0,elapsed-this.#impactAt),false);
 }
 public renderPress(progress:number,contactX:number):void{
  this.#bodyData.pressX=contactX;this.#bodyData.pressDepth=Math.max(0,Math.min(1,progress))*.40;
  this.#renderContact(0,false);
 }
 public renderBreak(progress:number,pressDepth=0,contactX=0):void{
  this.#bodyData.pressDepth=pressDepth;this.#bodyData.pressX=contactX;
  this.#renderContact(Math.max(0,Math.min(1,progress))*(this.#appearance==="bubble"?WATER_SPLASH_SECONDS:CLOUD_BURST_SECONDS),true);
 }
 #renderContact(age:number,breaking:boolean):void{
  const cloud=this.#appearance==="cloud",active=Number.isFinite(age)&&age<(cloud?CLOUD_BURST_SECONDS:WATER_SPLASH_SECONDS);
  const envelope=active?Math.sin(Math.min(1,age/.48)*Math.PI)*this.#force:0;
  const motion=this.#reduced ? .25 : 1;
  const inflate=cloud?envelope:envelope*.16;
  const gap=cloud&&breaking?cloudSplitGap(age,this.#force,this.#reduced):0;
  this.#bodyData.cloudWidth=this.#width+.35;
  this.#bodyData.width=this.#width+.35+gap*2.5;
  this.#bodyData.contactX=this.#contactX;this.#bodyData.splitGap=gap;
  this.#bodyData.waveForce=cloud&&active?this.#force*motion:0;
  if(cloud)this.#bodyData.time=active?age:0;
  this.body.setEnabled(true);
  const shellFade=Math.max(0,Math.min(1,(age-.04)/.20));
  const cloudFade=Math.max(0,Math.min(1,(age-.35)/.50));
  this.#bodyData.opacity=breaking?(cloud?1-cloudFade*cloudFade*(3-2*cloudFade):1-shellFade*shellFade*(3-2*shellFade)):1;
  const squash=cloud&&active?Math.sin(Math.min(1,age/.09)*Math.PI)*.10*motion:0;
  this.body.scaling.set(this.#bodyData.width/this.parent.scaling.x*(1+inflate*.22*motion+squash*.6),this.#bodyData.height*(1+inflate*.40*motion-squash),1);
  this.body.position.y=this.height/2-(cloud ? .55 : Math.min(1.3,Math.max(.6,this.#bodyData.width*.32)));
  if(cloud)this.#renderCloud(age,breaking&&active);
  else this.#mist?.setEnabled(false);
  this.#splashData.opacity=active&&!cloud?this.#water.update(age,this.#force,
   breaking?0:this.#contactX,breaking?this.body.position.y:this.height/2+.1,this.#reduced,breaking):0;
  this.splash.setEnabled(this.#splashData.opacity>0);
  if(this.#splashData.opacity<=0)return;
  this.splash.scaling.set(1/this.parent.scaling.x,1,1);
  this.#splashData.time=age;
  this.splash.updateVerticesData(VertexBuffer.PositionKind,this.#water.positions);
  this.splash.updateVerticesData("waterData",this.#water.waterData);this.splash.refreshBoundingInfo();
 }
 #renderCloud(age:number,active:boolean):void{
  if(!this.#mist){
   this.#mist=new Mesh(`${this.parent.name}-cloud-puffs`,this.parent.getScene());
   const data=new VertexData();data.positions=this.#cloud.positions;data.uvs=this.#cloud.uvs;data.indices=this.#cloud.indices;data.applyToMesh(this.#mist,true);
   this.#mist.setVerticesData("waterData",this.#cloud.waterData,true,2);
   this.#mist.metadata={sky:this.#mistData};this.#mist.material=this.body.material;
   this.#mist.parent=this.parent;this.#mist.position.z=this.body.position.z-.005;this.#mist.isPickable=false;
  }
  this.#mist.setEnabled(active);if(!active)return;
  this.#mistData.opacity=this.#cloud.update(age,this.#width,this.#contactX,this.body.position.y,this.#force,this.#reduced);
  this.#mist.scaling.set(1/this.parent.scaling.x,1,1);
  this.#mist.updateVerticesData(VertexBuffer.PositionKind,this.#cloud.positions);
  this.#mist.updateVerticesData("waterData",this.#cloud.waterData);this.#mist.refreshBoundingInfo();
 }
}
