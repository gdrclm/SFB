import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { VertexBuffer } from "@babylonjs/core/Buffers/buffer";
import { ShaderMaterial } from "@babylonjs/core/Materials/shaderMaterial";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import type { Scene } from "@babylonjs/core/scene";
import type { ApproachState } from "./PlatformReadability";
import { SURFACES, type SurfaceState } from "./PlatformSurfaces";
import { SURFACE_ANIMATION_URLS, surfaceAnimation, surfaceAnimationLayout, surfaceDestroyLayout, surfaceIdleFrames, surfaceBreakFrames, type AnimationRect, type SurfaceSprite } from "./SurfaceAnimation";
import { getPlatformLavaBlend, getPlatformLavaTint } from "./PlatformCrystalSkin";
import { platformImpactMotion } from "./PlatformImpactMotion";
import { SurfaceFracture, type FractureMaterial } from "./SurfaceFracture";
interface Paint {
 kind:number;width:number;seed:number;hits:number;cells:number;previousCells:number;time:number;broken:number;charge:number;reduced:boolean;
 popAt:number;previousHits:number;cellsAt:number;impactAt:number;force:number;layout:AnimationRect;destroyLayout:AnimationRect;
 rect:AnimationRect;destroyRect:AnimationRect;cue:readonly number[];frames:readonly number[];idleFrames:readonly number[];role:number;angle:number;
 age:number;duration:number;speed:number;contactX:number;shattering:boolean;material:number;materialRow:number;opacity:number;
 color:Float32Array;previousColor:Float32Array;colorAt:number;crystalPalette:boolean;
}
const vertex=`precision highp float;attribute vec3 position;attribute vec2 uv;attribute vec4 shardData;uniform mat4 worldViewProjection;varying vec2 vUV;varying vec4 vShard;
void main(){vUV=uv;vShard=shardData;gl_Position=worldViewProjection*vec4(position,1.0);}`;
const fragment=`precision highp float;varying vec2 vUV;varying vec4 vShard;
uniform sampler2D idleSky;uniform sampler2D idleSpecial;uniform sampler2D idleAdvanced;
uniform sampler2D destroySky;uniform sampler2D destroySpecial;uniform sampler2D destroyAdvanced;
uniform vec4 info;uniform vec4 motion;uniform vec4 artLayout;uniform vec4 destroyLayout;uniform vec4 artRect;uniform vec4 destroyRect;
uniform vec4 idleFrame;uniform vec4 breakFrame;uniform vec4 reaction;uniform vec4 cellsInfo;uniform vec4 cue;uniform vec4 torch;
uniform vec4 fracture;uniform vec4 crystalStyle;uniform float surfaceOpacity;
float inside(vec2 q){return step(0.0,q.x)*step(q.x,1.0)*step(0.0,q.y)*step(q.y,1.0);}
vec4 over(vec4 top,vec4 bottom){float a=top.a+bottom.a*(1.0-top.a);return vec4((top.rgb*top.a+bottom.rgb*bottom.a*(1.0-top.a))/max(.001,a),a);}
vec4 texel(vec2 uv,float broken){
 if(broken>.5){if(artLayout.w<.5)return texture2D(destroySky,uv);if(artLayout.w<1.5)return texture2D(destroySpecial,uv);return texture2D(destroyAdvanced,uv);}
 if(artLayout.w<.5)return texture2D(idleSky,uv);if(artLayout.w<1.5)return texture2D(idleSpecial,uv);return texture2D(idleAdvanced,uv);
}
vec4 image(vec2 q,float broken){
 vec4 rect=broken>.5?destroyRect:artRect;vec3 f=broken>.5?breakFrame.xyz:idleFrame.xyz;
 vec2 uv=rect.xy+clamp(q,vec2(.003),vec2(.997))*rect.zw;
 vec4 a=texel(uv+vec2(f.x/6.0,0.0),broken),b=texel(uv+vec2(f.y/6.0,0.0),broken);
 float alpha=mix(a.a,b.a,f.z);vec3 rgb=mix(a.rgb*a.a,b.rgb*b.a,f.z)/max(.001,alpha);
 return vec4(rgb,alpha*smoothstep(.025,.15,alpha)*inside(q));
}
vec4 part(vec2 p,vec2 center,vec2 size,vec4 region){vec2 q=(p-center)/size+.5;vec4 c=image(region.xy+q*region.zw,0.0);c.a*=inside(q);return c;}
float bit(float mask,float n){return mod(floor(mask/pow(2.0,n)),2.0);}
float ledgeU(float x,float w){float cap=min(.72,w*.25),middle=max(.01,w-2.0*cap),d=x+w*.5;
 if(d<cap)return d/cap*.23;if(d>w-cap)return .77+(d-w+cap)/cap*.23;
 float tiles=2.0*floor(middle/3.4)+1.0;return .23+(1.0-abs(mod((d-cap)/middle*tiles,2.0)-1.0))*.54;}
vec2 bodyUV(vec2 p){return (p-vec2(0.0,artLayout.z))/artLayout.xy+.5;}
void main(){
 float k=info.x,w=info.y,hits=info.w,b=motion.y,reduced=motion.w,t=motion.x*(1.0-reduced);
 vec2 p=(vUV-.5)*vec2(w+2.6,5.0)+vec2(0.0,-.7),point=p;vec4 c=vec4(0.0);
 if(idleFrame.w>.5){
  vec2 pivot=vec2(0.0,artLayout.z+((k>16.5?.60:.48)-.5)*artLayout.y),d=p-pivot;
  float a=breakFrame.w;point=pivot+mat2(cos(a),-sin(a),sin(a),cos(a))*d;
  vec2 q=bodyUV(point);c=image(q,0.0);
  if(k>16.5)c.a*=smoothstep(.575,.595,q.y)*(1.0-smoothstep(.15,.18,abs(q.x-.5)));
  else c.a*=1.0-smoothstep(.28,.30,length((q-vec2(.5,.48))*vec2(1.15,1.0)));
 }else if(k>4.5&&k<5.5){
  // Separate samples preserve the six-frame idle loop and the identity of
  // surviving balloons when the other balloons pop.
  float age=max(0.0,b)*.85,drop=b<0.0?0.0:age*age*6.0*(1.0-reduced);
  c=part(p+vec2(0.0,drop),vec2(0.0,artLayout.z+(.25-.5)*artLayout.y),artLayout.xy*vec2(.49,.50),vec4(.26,0.0,.49,.50));
  if(b>=0.0)c.a*=1.0-smoothstep(.70,1.0,b);
  for(int i=0;i<3;i++){
   float n=float(i);vec4 region=i==0?vec4(0.0,.38,.43,.62):i==1?vec4(.27,.42,.41,.58):vec4(.55,.38,.45,.60);
   vec2 center=vec2((region.x+region.z*.5-.5)*artLayout.x,artLayout.z+(region.y+region.w*.5-.5)*artLayout.y);
   float visible=step(n+.5,hits),pop=(1.0-visible)*step(n+.5,reaction.y)*(1.0-smoothstep(0.0,.12,reaction.x));
   if(b>=0.0){visible=0.0;pop=step(n+.5,hits)*(1.0-smoothstep(.025,.12,age-n*.018));}
   vec2 q=(p-center)/(artLayout.xy*region.zw*(1.0+pop*.12*(1.0-reduced)))+.5;
   if(i==0)q.x=min(q.x,1.0-q.x);if(i==2)q.x=max(q.x,1.0-q.x);
   vec4 balloon=image(region.xy+q*region.zw,0.0);balloon.a*=inside(q)*(1.0-smoothstep(.96,1.02,length((q-.5)/.49)))*max(visible,pop);c=over(balloon,c);
   float popTime=b>=0.0?age-n*.018:reaction.x;float ring=exp(-abs(length((p-center)/(artLayout.xy*region.zw))-(.45+popTime*2.0))*60.0)*(1.0-smoothstep(.04,.22,popTime))*step(0.0,popTime)*(1.0-visible)*step(n+.5,b>=0.0?hits:reaction.y);
   c=over(vec4(i==0?vec3(1.0,.4,.55):i==1?vec3(1.0,.9,.3):vec3(.4,.9,1.0),ring),c);
  }
 }else if(k>8.5&&k<9.5&&b<0.0){
  vec2 q=bodyUV(p);c=image(q,0.0);c.a*=smoothstep(.085,.11,abs(q.x-.5));
  float beam=exp(-abs(p.y-.15)*45.0)*(1.0-smoothstep(w*.40,w*.48,abs(p.x)));
  c=over(vec4(.65,.97,1.0,beam),c);
  float lockX=(mod(info.z,3.0)-1.0)*w*.22;c=over(part(p,vec2(lockX,.15),vec2(.52,.70),vec4(.40,.18,.20,.62)),c);
 }else if(k>9.5&&k<10.5){
  float stepX=w/8.0,index=floor((p.x+w*.5)/stepX),present=bit(cellsInfo.x,clamp(index,0.0,7.0));
  float previous=bit(cellsInfo.y,clamp(index,0.0,7.0)),fade=(1.0-present)*previous*(1.0-smoothstep(0.0,.12,cellsInfo.z));
  vec2 q=(p-vec2((index+.5)*stepX-w*.5,-.12))/vec2(stepX*1.02,max(.34,stepX*.98))+.5;
  c=image(q,b<0.0?0.0:1.0);c.a*=max(present,fade)*step(0.0,index)*step(index,7.0);
  if(index==2.0||index==5.0)c.rgb=mix(c.rgb,vec3(1.0,.74,.18)*dot(c.rgb,vec3(.3,.6,.1))*1.5,.65);
  if(b>=0.0)c.a*=1.0-smoothstep(.80,1.0,b);
 }else{
  if(k>5.5&&k<6.5)point.y+=motion.z*.25*exp(-p.x*p.x);
  vec2 q=bodyUV(point);
  if(k<.5||k>2.5&&k<4.5||k>6.5&&k<8.5||k>10.5&&k<11.5||k>13.5&&k<14.5)q.x=ledgeU(point.x,artLayout.x);
  c=image(q,0.0);c.a*=step(abs(point.x),artLayout.x*.5);
  if(k>7.5&&k<8.5)c.a*=.38;
  if(k>16.5)c.a*=1.0-smoothstep(.58,.60,q.y);
  if(k>13.5&&k<14.5){
   float group=mod(info.z,3.0);vec3 tint=group<.5?vec3(.8,.3,1.0):group<1.5?vec3(1.0,.76,.22):vec3(.2,.95,1.0);c.rgb=mix(c.rgb,c.rgb*tint*1.7,.30);
   vec2 rune=(q-vec2(.50,.50))*artLayout.xy;float d=group<.5?abs(length(rune)-.10):group<1.5?abs(abs(rune.x)+abs(rune.y)-.14):max(min(abs(rune.x-.045),abs(rune.x+.045)),abs(rune.y)-.09);
   c.rgb+=tint*exp(-d*100.0);
  }
 }
 if(b>=0.0&&k>7.5&&k<8.5){
  float band=floor(p.y*22.0),noise=fract(sin(band*12.7+info.z)*43758.5);c.a*=1.0-smoothstep(noise*.65,noise*.65+.22,b);
 }
 // Fragments keep the original pose and artwork. Only their vertices move;
 // there is no crossfade between pictures of an entire broken platform.
 if(fracture.w>.5){
  if(k>15.5){vec2 pivot=vec2(0.0,artLayout.z+((k>16.5?.60:.48)-.5)*artLayout.y),d=p-pivot;float a=breakFrame.w;vec2 q=bodyUV(pivot+mat2(cos(a),-sin(a),sin(a),cos(a))*d);vec4 moving=image(q,0.0);
   if(k>16.5)moving.a*=smoothstep(.575,.595,q.y)*(1.0-smoothstep(.15,.18,abs(q.x-.5)));else moving.a*=1.0-smoothstep(.28,.30,length((q-vec2(.5,.48))*vec2(1.15,1.0)));c=over(moving,c);}
  if(fracture.w<1.5){
   float age=fracture.x,edge=pow(clamp((vShard.w-.72)/.28,0.0,1.0),4.0);vec3 glow=k<.5?vec3(1.0,.82,.42):k>3.5&&k<4.5?vec3(1.0,.7,.3):vec3(.25,.85,1.0);
   c.rgb=c.rgb*(1.0-edge*.12)+glow*edge*exp(-age*6.0)*.8;
   if(fracture.y>.5&&fracture.y<1.5||fracture.y>2.5){float r=length((p-vShard.xy)/max(.03,vShard.z*.85));c.a*=mix(1.0,1.0-smoothstep(.7,1.0,r),smoothstep(.08,.32,age));}
  }
 }
 if(k>6.5&&k<7.5||k>10.5&&k<11.5&&crystalStyle.a>=0.0){
  float light=pow(clamp(dot(c.rgb,vec3(.2126,.7152,.0722)),0.0,1.0),.65);c.rgb=mix(c.rgb,crystalStyle.rgb*(light+.12)+c.rgb*.23,.64);
  c.a=min(1.0,c.a*1.5);
  if(crystalStyle.a>2.5&&crystalStyle.a<3.5){for(int i=0;i<3;i++){vec2 q=p-vec2((float(i)-1.0)*w*.28,.43);float d=min(max(abs(q.x)-.035,abs(q.y)-.12),max(abs(q.x)-.12,abs(q.y)-.035));c=over(vec4(.55,1.0,.72,exp(-max(0.0,d)*60.0)*.85),c);}}
  if(crystalStyle.a>3.5){float r=length(vec2(p.x/max(.1,w*.25),(p.y-.15)/.12));float rings=exp(-abs(r-.75)*40.0)+exp(-abs(r-1.2)*40.0);c=over(vec4(.6,1.0,1.0,rings*.75),c);}
 }
 float impact=exp(-max(0.0,reaction.z)*22.0)*step(0.0,reaction.z);c.rgb+=vec3(.18,.22,.25)*impact*reaction.w;
 if(cue.a>0.0&&b<0.0&&idleFrame.w<.5){float top=k>14.5?motion.z:.15;float rim=exp(-abs(p.y-top)*55.0)*(1.0-smoothstep(w*.4,w*.5,abs(p.x)));c=over(vec4(cue.rgb,rim*.8),c);}
 if(k>11.5&&k<12.5&&motion.z>0.0&&b<0.0){float r=length((p-vec2(0.0,-.5))*vec2(.8,1.0));float ring=exp(-abs(r-(.6+fract(t*.45)*.9))*65.0)*motion.z*.40*(1.0-smoothstep(1.0,1.6,r));c=over(vec4(.2,.85,1.0,ring),c);}
 float lum=dot(c.rgb,vec3(.2126,.7152,.0722));c.rgb=mix(c.rgb,vec3(.09,.07,.06)+torch.rgb*pow(clamp(lum,0.0,1.0),.65)*.60+c.rgb*.16,torch.a);
 float decay=fracture.w>.5&&fracture.w<1.5?1.0-smoothstep(.58,.85,fracture.x):1.0;
 gl_FragColor=vec4(c.rgb,clamp(c.a*decay*surfaceOpacity,0.0,1.0));
}`;
const MATERIAL_COLORS=[[.20,.74,1],[1,.55,.06],[1,.08,.23],[.12,1,.42],[.10,.86,1]] as const;
const resources=new WeakMap<Scene,{material:ShaderMaterial;textures:readonly Texture[]}>();
export function prepareSurfaceSkin(scene:Scene):ShaderMaterial{
 const cached=resources.get(scene);if(cached)return cached.material;
 const textures=SURFACE_ANIMATION_URLS.map((url,index)=>{const t=new Texture(url,scene,true,true,Texture.BILINEAR_SAMPLINGMODE);t.name=`SurfaceAnimationAtlas${String(index)}`;t.hasAlpha=true;t.wrapU=t.wrapV=Texture.CLAMP_ADDRESSMODE;return t;});
 const names=["idleSky","idleSpecial","idleAdvanced","destroySky","destroySpecial","destroyAdvanced"];
 const material=new ShaderMaterial("SurfaceMaterial",scene,{vertexSource:vertex,fragmentSource:fragment},{attributes:["position","uv","shardData"],
  uniforms:["worldViewProjection","info","motion","artLayout","destroyLayout","artRect","destroyRect","idleFrame","breakFrame","reaction","cellsInfo","cue","torch","fracture","crystalStyle","surfaceOpacity"],samplers:names,needAlphaBlending:true});
 textures.forEach((texture,i)=>material.setTexture(names[i]??"idleSky",texture));material.backFaceCulling=false;material.disableDepthWrite=true;
 material.onBindObservable.add(mesh=>{
  const metadata=mesh.metadata as {surface:Paint;fragments?:boolean},p=metadata.surface,e=material.getEffect();
  e.setFloat4("info",p.kind,p.width,p.seed,p.hits);e.setFloat4("motion",p.time,p.shattering?-1:p.broken,p.charge,p.reduced?1:0);
  e.setFloat4("artLayout",...p.layout);e.setFloat4("destroyLayout",...p.destroyLayout);e.setFloat4("artRect",...p.rect);e.setFloat4("destroyRect",...p.destroyRect);
  e.setFloat4("idleFrame",p.idleFrames[0]??0,p.idleFrames[1]??0,p.idleFrames[2]??0,p.role);e.setFloat4("breakFrame",p.frames[0]??0,p.frames[1]??0,p.frames[2]??0,p.angle);
  e.setFloat4("reaction",p.time-p.popAt,p.previousHits,p.time-p.impactAt,p.force);e.setFloat4("cellsInfo",p.cells,p.previousCells,p.time-p.cellsAt,0);
  e.setFloat4("cue",p.cue[0]??0,p.cue[1]??0,p.cue[2]??0,p.cue[3]??0);
  const tint=getPlatformLavaTint(p.cue[3]?(p.cue[1]??0)>.5?1:2:0);e.setFloat4("torch",tint[0],tint[1],tint[2],getPlatformLavaBlend(scene));
  e.setFloat4("fracture",p.age,p.material,p.contactX,metadata.fragments?1:p.shattering?2:0);
  e.setFloat4("crystalStyle",p.color[0]??0,p.color[1]??0,p.color[2]??0,p.crystalPalette?p.materialRow:-1);
  e.setFloat("surfaceOpacity",p.opacity);
 });
 resources.set(scene,{material,textures});material.onDisposeObservable.addOnce(()=>resources.delete(scene));return material;
}
export function surfaceArtTextures(scene:Scene):readonly Texture[]{prepareSurfaceSkin(scene);return resources.get(scene)?.textures??[];}
const EMPTY:AnimationRect=[1,1,0,0];
/** Painted six-frame animations share GPU textures and reuse one quad per slot. */
export class SurfaceSkin{
 readonly mesh:Mesh;
 readonly #paint:Paint={kind:0,width:3,seed:0,hits:1,cells:255,previousCells:255,time:0,broken:-1,charge:0,reduced:false,
  popAt:-Infinity,previousHits:1,cellsAt:-Infinity,impactAt:-Infinity,force:1,layout:EMPTY,destroyLayout:EMPTY,rect:EMPTY,destroyRect:EMPTY,cue:[0,0,0,0],frames:[0,0,0],idleFrames:[0,0,0],role:0,angle:0,
  age:0,duration:.85,speed:18,contactX:0,shattering:false,material:0,materialRow:0,opacity:1,
  color:new Float32Array(MATERIAL_COLORS[0]),previousColor:new Float32Array(MATERIAL_COLORS[0]),colorAt:-Infinity,crystalPalette:false};
 #shapeKey="";
 #pieces:{mesh:Mesh;geometry:SurfaceFracture}|null=null;
 #breakPose:readonly number[]|null=null;
 public get fractureMesh():Mesh|null{return this.#pieces?.mesh??null;}
 public constructor(private readonly parent:Mesh,scene:Scene,name="surface",role=0,private readonly contactTop=.15){
  this.#paint.role=role;this.mesh=MeshBuilder.CreatePlane(`${parent.name}-${name}`,{width:1,height:5},scene);this.mesh.parent=parent;this.mesh.position.set(0,-.7,-.65);
  this.mesh.isPickable=false;this.mesh.material=prepareSurfaceSkin(scene);this.mesh.metadata={surface:this.#paint};this.mesh.setEnabled(false);
  this.mesh.setVerticesData("shardData",new Float32Array(16),false,4);
 }
 public hide():void{this.mesh.setEnabled(false);this.#pieces?.mesh.setEnabled(false);}
 public reset():void{this.hide();this.#shapeKey="";this.#breakPose=null;Object.assign(this.#paint,{impactAt:-Infinity,popAt:-Infinity,cellsAt:-Infinity,angle:0,age:0,shattering:false,materialRow:0,opacity:1});this.mesh.position.y=-.7;this.mesh.rotation.z=0;}
 public impact(time:number,force:number,contactX=this.#paint.contactX):void{this.#paint.impactAt=time;this.#paint.force=force;this.#paint.contactX=contactX;}
 public prepareBreak(speed:number,contactX:number,power=false):void{this.#paint.speed=speed*(power?1.1:1);this.#paint.contactX=contactX;}
 public material(row:number,crystal=true):void{
  const p=this.#paint;p.crystalPalette=crystal;
  if(!this.#shapeKey){p.materialRow=row;p.color.set(MATERIAL_COLORS[row]??MATERIAL_COLORS[0]);p.colorAt=-Infinity;}
  else if(row!==p.materialRow){p.previousColor.set(p.color);p.materialRow=row;p.colorAt=p.time;}
 }
 public opacity(value:number):void{this.#paint.opacity=value;}
 public aim(angle:number):void{this.#paint.angle=angle;}
 #preparePieces(kind:SurfaceSprite):void{
  const p=this.#paint,material:FractureMaterial=kind==="storm"?"vapor":kind==="web"?"silk":kind==="liquid"?"liquid":"solid";
  p.material=material==="vapor"?1:material==="silk"?2:material==="liquid"?3:0;
  if(!this.#pieces){
   const geometry=new SurfaceFracture(),mesh=new Mesh(`${this.mesh.name}-fragments`,this.mesh.getScene()),data=new VertexData();
   data.positions=geometry.positions;data.uvs=geometry.uvs;data.indices=geometry.indices;data.applyToMesh(mesh,true);mesh.setVerticesData("shardData",geometry.shardData,true,4);
   mesh.parent=this.parent;mesh.material=this.mesh.material;mesh.position.z=this.mesh.position.z-.01;mesh.metadata={surface:p,fragments:true};mesh.isPickable=false;mesh.alwaysSelectAsActiveMesh=true;mesh.setEnabled(false);
   this.#pieces={mesh,geometry};
  }
  const extra=kind==="turret"?.5:.08;
  this.#pieces.geometry.prepare({left:-p.layout[0]/2-extra,right:p.layout[0]/2+extra,bottom:p.layout[2]-p.layout[1]/2,top:p.layout[2]+p.layout[1]/2},p.width,p.contactX,p.speed,p.seed,material,p.reduced);
  const mesh=this.#pieces.mesh;mesh.scaling.x=1/Math.max(.01,this.parent.scaling.x);
  mesh.updateVerticesData(VertexBuffer.UVKind,this.#pieces.geometry.uvs);mesh.updateVerticesData("shardData",this.#pieces.geometry.shardData);
 }
 public render(kind:SurfaceSprite,width:number,seed:number,state:SurfaceState,approach:ApproachState|null,time:number,reduced:boolean,broken=-1):void{
  const p=this.#paint,art=surfaceAnimation(kind);if(!art){this.hide();return;}
  const key=`${kind}:${String(width)}:${String(seed)}`;
  if(key!==this.#shapeKey){const layout=surfaceAnimationLayout(art,width);p.layout=[layout[0],layout[1],layout[2]+this.contactTop-.15,layout[3]];p.destroyLayout=surfaceDestroyLayout(art,p.layout);p.rect=art.idle[0]??EMPTY;p.destroyRect=art.destroy[0]??EMPTY;
   p.hits=state.hits;p.cells=state.cells;p.previousHits=state.hits;p.previousCells=state.cells;this.#shapeKey=key;}
  if(state.hits!==p.hits){p.previousHits=p.hits;p.popAt=time;}if(state.cells!==p.cells){p.previousCells=p.cells;p.cellsAt=time;}
  const index=(SURFACES as readonly string[]).indexOf(kind),id=index>=0?index:kind==="moving"?15:kind==="turret"?17:16;
  Object.assign(p,{kind:id,width,seed,hits:state.hits,cells:state.cells,time,charge:state.charge,reduced,broken});
  if(broken<0){const t=Math.max(0,Math.min(1,(time-p.colorAt)/.18)),blend=t*t*(3-2*t),target=MATERIAL_COLORS[p.materialRow]??MATERIAL_COLORS[0];
   for(let i=0;i<3;i++)p.color[i]=(p.previousColor[i]??0)*(1-blend)+(target[i]??0)*blend;}
  if(id>=15)p.charge=this.contactTop;
  p.shattering=broken>=0&&kind!=="balloons"&&kind!=="hologram"&&p.role===0;
  if(broken<0){this.#breakPose=null;p.idleFrames=surfaceIdleFrames(time,seed,reduced);this.#pieces?.mesh.setEnabled(false);}
  else{
   if(!this.#breakPose){this.#breakPose=p.idleFrames;if(p.shattering)this.#preparePieces(kind);}
   p.idleFrames=this.#breakPose;p.frames=surfaceBreakFrames(broken,reduced);p.age=Math.max(0,broken)*p.duration;
  }
  p.cue=approach==="danger"?[1,.12,.25,1]:approach==="boost"?[1,.65,.08,1]:[.15,.85,1,0];
  this.mesh.scaling.x=(width+2.6)/Math.max(.01,this.parent.scaling.x);this.mesh.setEnabled(true);
  const kick=platformImpactMotion(broken>=0?broken:time-p.impactAt,p.force,reduced);this.mesh.position.y=kick.y-.7;this.mesh.rotation.z=kick.rotation;
  if(p.shattering&&this.#pieces){
   this.#pieces.geometry.update(p.age);this.#pieces.mesh.updateVerticesData(VertexBuffer.PositionKind,this.#pieces.geometry.positions);
   this.#pieces.mesh.setEnabled(p.age>=.025&&broken<1);this.mesh.setEnabled(p.age<.025);
  }
 }
}
