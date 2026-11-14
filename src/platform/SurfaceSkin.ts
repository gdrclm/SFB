import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { ShaderMaterial } from "@babylonjs/core/Materials/shaderMaterial";
import type { Scene } from "@babylonjs/core/scene";
import type { ApproachState } from "./PlatformReadability";
import { SURFACES, type PlatformSurface, type SurfaceState } from "./PlatformSurfaces";
import { platformImpactMotion } from "./PlatformImpactMotion";
interface Paint { kind:number; width:number; seed:number; hits:number; cells:number; time:number; broken:number; charge:number; infection:number; cue:readonly number[] }
const vertex=`precision highp float;attribute vec3 position;attribute vec2 uv;uniform mat4 worldViewProjection;varying vec2 vUV;void main(){vUV=uv;gl_Position=worldViewProjection*vec4(position,1.0);}`;
const fragment=`precision highp float;varying vec2 vUV;uniform vec4 info;uniform vec4 motion;uniform vec4 cue;uniform float cells;
float box(vec2 p,vec2 h){vec2 q=abs(p)-h;return length(max(q,0.0))+min(max(q.x,q.y),0.0);}
float disk(vec2 p,float r){return length(p)-r;}
float line(vec2 p,vec2 a,vec2 b,float r){vec2 d=b-a;return length(p-a-d*clamp(dot(p-a,d)/max(.001,dot(d,d)),0.0,1.0))-r;}
float hash(float n){return fract(sin(n*37.3)*43758.54);}
void main(){
 float k=info.x,w=info.y,seed=info.z,hits=info.w,t=motion.x,b=motion.y;
 if(k>4.5&&k<5.5&&b>.05)hits=0.0;
 vec2 p=(vUV-.5)*vec2(w+1.4,3.6);
 if(b>=0.0){
  if(k>12.5&&k<13.5){p.x/=1.0+b*.45;p.y*=1.0+b*2.0;}
  else{float tile=floor((p.x+w*.5)/max(.3,w/5.0));p.x-=(hash(tile+seed)-.5)*b*2.5;p.y+=b*b*3.5+hash(tile)*b;}
 }
 float d=10.0;vec3 color=vec3(.10,.28,.49),light=cue.rgb;float extra=0.0,field=0.0;
 if(k<.5){
  d=max(abs(p.x)-(w*.5+min(0.0,p.y)*.42),max(p.y-.12,-.86-p.y-.09*sin(p.x*6.0+seed)));
  float facet=hash(floor(p.x*3.0)+floor(p.y*4.0)*13.0);
  color=mix(vec3(.19,.23,.26),vec3(.45,.46,.39),facet*.8+clamp(p.y+1.0,0.0,1.0)*.2);
  if(p.y>-.08){color=mix(vec3(.16,.48,.10),vec3(.55,.94,.22),smoothstep(-.08,.12,p.y));color+=.12*pow(abs(sin(p.x*27.0)),6.0);}
  light=p.y>-.08?vec3(.55,1.0,.28):vec3(.42,.55,.54);
  for(int i=0;i<5;i++){float x=(float(i)/4.0-.5)*w*.8;d=min(d,line(p,vec2(x,-.8),vec2(x+.15*sin(float(i)),-1.35),.024));}
  if(hits>1.5){float seam=abs(fract((p.y+.2)*6.0)-.5);color*=.65+.35*smoothstep(.02,.10,seam);}
  for(int i=0;i<3;i++){if(float(i)<hits)color+=vec3(.8,.9,.5)*exp(-length(p-vec2((float(i)-(hits-1.0)*.5)*.22,-.35))*50.0);}
  float trunk=line(p,vec2(w*.25,.12),vec2(w*.25,.55),.035);d=min(d,trunk);
  float leaves=disk(p-vec2(w*.25,.65),.20);if(leaves<d){d=leaves;color=vec3(.22,.65,.12);}
 }else if(k<3.5){
  for(int i=0;i<6;i++){float a=float(i)/5.0;d=min(d,disk(p-vec2((a-.5)*w*.85,-.22+.14*sin(a*8.0)),.38+w*.035));}
  color=mix(vec3(.08,.09,.17),vec3(.30,.31,.48),clamp((p.y+.6)*.8,0.0,1.0));light=vec3(.64,.55,1.0);
  float bolt=line(p,vec2(-.12,.0),vec2(.10,-.28),.025);bolt=min(bolt,line(p,vec2(.10,-.28),vec2(-.06,-.58),.025));
  extra=exp(-abs(bolt)*38.0)*(.65+.35*sin(t*17.0));
 }else if(k<4.5){
  d=max(length(vec2(p.x/(w*.48),p.y/.60))-1.0,p.y+.04);
  float weave=sin(p.x*30.0+p.y*18.0)*sin(p.x*19.0-p.y*27.0);
  color=vec3(.43,.24,.09)+vec3(.18,.13,.06)*weave;light=vec3(.76,.49,.21);
  float rim=abs(length(vec2(p.x/(w*.48),p.y/.13))-1.0)*.10-.025;
  d=min(d,rim);
  for(int i=0;i<3;i++){vec2 q=(p-vec2((float(i)-1.0)*.31,.08))*vec2(1.0,.73);float e=disk(q,.17);if(e<d){d=e;color=vec3(.98,.93,.75)*(.65+.35*sqrt(max(0.0,1.0-dot(q,q)/.029)));light=vec3(1.0,.92,.65);}}
 }else if(k<5.5){
  for(int i=0;i<3;i++){if(float(i)>=hits)continue;float x=(float(i)-1.0)*w*.31;float q=disk((p-vec2(x,-.3))*vec2(1.0,.85),min(.44,w*.15));
   if(q<d){d=q;color=i==0?vec3(1.0,.16,.32):i==1?vec3(1.0,.65,.06):vec3(.06,.52,1.0);color*=.55+.45*sqrt(clamp(-q*5.0,0.0,1.0));color+=vec3(.8)*exp(-length(p-vec2(x-.10,-.12))*40.0);}
   float string=line(p,vec2(x,-.7),vec2(0,-1.14),.014);if(string<d){d=string;color=vec3(.85,.85,.72);}}
  float basket=box(p-vec2(0,-1.20),vec2(w*.25,.11));if(basket<d){d=basket;color=vec3(.55,.32,.12)+.08*sin(p.x*35.0);}
  light=vec3(.8,.8,.6);
 }else if(k<6.5){
  vec2 q=vec2(p.x/max(1.0,w*.5),(p.y+.35)/.65);float a=atan(q.y,q.x);float r=length(q);
  d=max(min(abs(sin(a*4.0))*r*.3,abs(fract(r*4.0)-.5)*.15)-.014,r-1.0);
  color=vec3(.65,.85,.96);light=vec3(.65,.9,1.0);extra=motion.z*.2;
  vec2 spider=p-vec2(w*.32+motion.z*w*.3,-.3);float spiderBody=disk(spider,.07);
  if(spiderBody<d){d=spiderBody;color=vec3(.16,.20,.30);}
 }else if(k<8.5){
  d=max(abs(p.x)-(w*.5+min(0.0,p.y)*.25),max(p.y-.1,-.6-p.y));color=vec3(.10,.5,.85);light=vec3(.24,.88,1.0);
 }else if(k<9.5){
  d=box(p,vec2(w*.5,.035));color=vec3(.17,.8,1.0);light=vec3(.15,.95,1.0);
  float lockX=(mod(seed,3.0)-1.0)*w*.22;float lock=abs(p.x-lockX)+abs(p.y)-.26;
  if(lock<d){d=lock;color=vec3(1.0,.16,.19);light=vec3(1.0,.4,.2);}
  d=min(d,min(disk(p-vec2(w*.5,0),.12),disk(p+vec2(w*.5,0),.12)));
 }else if(k<10.5){
  float stepX=w/8.0;
  for(int i=0;i<8;i++){if(mod(floor(cells/pow(2.0,float(i))),2.0)<.5)continue;
   vec2 q=abs((p-vec2((float(i)+.5)*stepX-w*.5,-.2))/vec2(max(.18,stepX),.55));
   float hex=(max(q.x*.866+q.y*.5,q.y)-.64)*min(stepX,.55);
   if(hex<d){d=hex;light=i==2||i==5?vec3(1.0,.76,.20):vec3(.25,.92,1.0);color=light*(.12+.25*q.y);extra=exp(-abs(hex+.06)*100.0)*.35;
    if(i==2||i==5)extra+=exp(-length(q)*18.0)*.7;}}
 }else if(k<11.5){
  for(int i=0;i<7;i++){float x=(float(i)/6.0-.5)*w*.8;vec2 q=p-vec2(x,-.25);d=min(d,max(abs(q.x)*1.8+q.y*.5-.16,max(-.6-q.y,q.y-.5)));}
  color=vec3(.12,.025,.13)+vec3(.20,.04,.12)*fract(p.x*8.5+p.y*2.0);light=vec3(1.0,.08,.23);extra=.3*pow(abs(sin(p.x*11.0-p.y*19.0)),20.0);
 }else if(k<12.5){
  vec2 q=p-vec2(0,-.3);float r=min(.55,w*.25);d=max(abs(length(q)-r)-.13,-q.y-.34);
  color=vec3(.35,.48,.66)*(.65+.35*sin(atan(q.y,q.x)*2.0));light=vec3(.3,.86,1.0);
  float poles=min(box(p-vec2(-r,.0),vec2(.14,.14)),box(p-vec2(r,.0),vec2(.14,.14)));d=min(d,poles);
  field=exp(-abs(length(q*vec2(.7,1.0))-r-.35-fract(t*.7)*.4)*50.0)*motion.z*.5;
 }else if(k<13.5){
  d=(length(vec2(p.x/(w*.5),p.y/.22))-1.0)*.22;color=vec3(.33,.12,.8);light=vec3(.7,.45,1.0);extra=.25*pow(abs(sin(p.x*5.0+p.y*17.0+t*2.0)),8.0);
  color+=vec3(.45,.35,.5)*exp(-abs(p.y-.055)*60.0)*exp(-abs(p.x)*.5);
 }else{
  vec2 q=p-vec2(0,-.25);d=max(box(q,vec2(w*.5,.37)),abs(q.x)+abs(q.y)-w*.5-.25);float group=mod(seed,3.0);
  light=group<.5?vec3(.8,.3,1.0):group<1.5?vec3(1.0,.73,.14):vec3(.15,.95,1.0);color=light*(p.y>-.04?.37:.10);
  color+=light*.06*step(.9,fract(p.x*2.0));
  float emblem=group<.5?abs(length(q)-.18):group<1.5?abs(abs(q.x)+abs(q.y)-.24):max(min(abs(q.x-.09),abs(q.x+.09)),abs(q.y)-.17);
  extra=exp(-emblem*65.0);
 }
 float body=1.0-smoothstep(-.012,.025,d);float edge=exp(-abs(d)*38.0);
 float neon=step(6.5,k),halo=exp(-max(0.0,d)*(neon>.5?13.0:24.0))*(neon>.5?.45:.12);
 float alpha=max(max(body,halo),field);color=mix(light*.8,color,body);
 color+=light*(edge*(neon>.5?1.25:.35)+max(0.0,extra));
 if(k>7.5&&k<8.5){float band=step(.20,fract(p.y*15.0-t*1.4));alpha*=.22+.24*band;color+=vec3(.6,.1,.8)*step(.94,fract(t*3.0+p.y*2.0));}
 if(b>=0.0)alpha*=1.0-smoothstep(.5,1.0,b);
 gl_FragColor=vec4(color,clamp(alpha,0.0,1.0));
}`;
const materials=new WeakMap<Scene,ShaderMaterial>();
export function prepareSurfaceSkin(scene:Scene):ShaderMaterial {
 const old=materials.get(scene);if(old)return old;
 const m=new ShaderMaterial("SurfaceMaterial",scene,{vertexSource:vertex,fragmentSource:fragment},{attributes:["position","uv"],uniforms:["worldViewProjection","info","motion","cue","cells"],needAlphaBlending:true});
 m.backFaceCulling=false;m.disableDepthWrite=true;
 m.onBindObservable.add(mesh=>{const p=(mesh.metadata as {surface:Paint}).surface;const e=m.getEffect();e.setFloat4("info",p.kind,p.width,p.seed,p.hits);e.setFloat4("motion",p.time,p.broken,p.charge,p.infection);e.setFloat4("cue",p.cue[0]??0,p.cue[1]??0,p.cue[2]??0,1);e.setFloat("cells",p.cells);});
 materials.set(scene,m);m.onDisposeObservable.addOnce(()=>materials.delete(scene));return m;
}
export class SurfaceSkin {
 readonly mesh:Mesh;
 readonly #paint:Paint={kind:0,width:3,seed:0,hits:1,cells:255,time:0,broken:-1,charge:0,infection:0,cue:[.2,.8,1]};
 #impactAt=-Infinity;#force=1;
 public constructor(private readonly parent:Mesh,scene:Scene){
  this.mesh=MeshBuilder.CreatePlane(`${parent.name}-surface`,{width:1,height:3.6},scene);this.mesh.parent=parent;this.mesh.position.z=-.65;
  this.mesh.isPickable=false;this.mesh.material=prepareSurfaceSkin(scene);this.mesh.metadata={surface:this.#paint};this.mesh.setEnabled(false);
 }
 public hide():void{this.mesh.setEnabled(false);}
 public reset():void{this.hide();this.#impactAt=-Infinity;this.mesh.position.y=0;this.mesh.rotation.z=0;}
 public impact(time:number,force:number):void{this.#impactAt=time;this.#force=force;}
 public render(surface:PlatformSurface,width:number,seed:number,state:SurfaceState,approach:ApproachState|null,time:number,reduced:boolean,broken=-1):void{
  Object.assign(this.#paint,{kind:SURFACES.indexOf(surface),width,seed,hits:state.hits,cells:state.cells,time:reduced?0:time,charge:state.charge,infection:state.infection,broken});
  this.#paint.cue=approach==="danger"?[1,.12,.25]:approach==="boost"?[1,.65,.08]:[.15,.85,1];
  this.mesh.scaling.x=(width+1.4)/Math.max(.01,this.parent.scaling.x);this.mesh.setEnabled(true);
  const motion=platformImpactMotion(broken>=0?broken:time-this.#impactAt,this.#force,reduced);
  this.mesh.position.y=motion.y;this.mesh.rotation.z=motion.rotation;
 }
}
