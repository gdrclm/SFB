import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { ShaderMaterial } from "@babylonjs/core/Materials/shaderMaterial";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import type { Scene } from "@babylonjs/core/scene";
import type { ApproachState } from "./PlatformReadability";
import { SURFACES, type PlatformSurface, type SurfaceState } from "./PlatformSurfaces";
import { SURFACE_ART, SURFACE_ART_URLS, surfaceArtLayout, surfaceUVRect, surfaceBreakFrames } from "./SurfaceArt";
import { platformImpactMotion } from "./PlatformImpactMotion";

interface Paint {
  kind:number;width:number;seed:number;hits:number;cells:number;previousCells:number;
  time:number;broken:number;charge:number;reduced:boolean;burst:number;
  popAt:number;previousHits:number;cellsAt:number;impactAt:number;force:number;
  rect:readonly number[];layout:readonly number[];cue:readonly number[];
  frames:readonly number[];
}
const vertex=`precision highp float;attribute vec3 position;attribute vec2 uv;uniform mat4 worldViewProjection;varying vec2 vUV;
void main(){vUV=uv;gl_Position=worldViewProjection*vec4(position,1.0);}`;
const fragment=`precision highp float;varying vec2 vUV;
uniform sampler2D skyArt;uniform sampler2D specialArt;uniform sampler2D crystalArt;uniform sampler2D breakArt;
uniform vec4 info;uniform vec4 motion;uniform vec4 artLayout;uniform vec4 artRect;uniform vec4 reaction;uniform vec4 cellsInfo;uniform vec4 cue;
uniform vec3 breakFrames;
float inside(vec2 q){return step(0.0,q.x)*step(q.x,1.0)*step(0.0,q.y)*step(q.y,1.0);}
vec4 over(vec4 top,vec4 bottom){float a=top.a+bottom.a*(1.0-top.a);return vec4((top.rgb*top.a+bottom.rgb*bottom.a*(1.0-top.a))/max(.001,a),a);}
vec4 sheet(vec2 uv,float atlas){if(atlas<.5)return texture2D(skyArt,uv);if(atlas<1.5)return texture2D(specialArt,uv);return texture2D(crystalArt,uv);}
vec4 art(vec2 q,vec4 rect,float atlas){
 vec2 uv=rect.xy+clamp(q,vec2(.002),vec2(.998))*rect.zw;
 vec4 c=sheet(uv,atlas);c.a*=smoothstep(.035,.16,c.a)*inside(q);return c;
}
vec4 pixels(float x,float y,float w,float h){return vec4(x,1254.0-y-h,w,h)/1254.0;}
vec4 sprite(vec2 p,vec2 center,vec2 size,vec4 rect,float atlas){return art((p-center)/size+.5,rect,atlas);}
float bit(float mask,float n){return mod(floor(mask/pow(2.0,n)),2.0);}
// Preserve end caps and trees on broad ledges. Mirrored middle tiles join
// continuously and retain the painting's material scale at different widths.
float ledgeU(float x,float w){
 float cap=min(.72,w*.25),middle=max(.01,w-2.0*cap),d=x+w*.5;
 if(d<cap)return d/cap*.23;if(d>w-cap)return .77+(d-w+cap)/cap*.23;
 float tiles=2.0*floor(middle/3.4)+1.0,s=(d-cap)/middle*tiles;
 return .23+(1.0-abs(mod(s,2.0)-1.0))*.54;
}
vec4 burst(vec2 p,float b,float row,float w){
 float a=breakFrames.x,z=breakFrames.y,blend=breakFrames.z;
 float scale=mix(.85,1.2,b*(1.0-motion.w));vec2 q=(p-vec2(0.0,-.25-b*b*.35*(1.0-motion.w)))/vec2((w+1.4)*scale,2.8*scale)+.5;
 vec2 local=clamp(q,vec2(.009),vec2(.991));
 vec4 c=texture2D(breakArt,(vec2(a,3.0-row)+local)/4.0),d=texture2D(breakArt,(vec2(z,3.0-row)+local)/4.0);
 float alpha=mix(c.a,d.a,blend);vec3 rgb=mix(c.rgb*c.a,d.rgb*d.a,blend)/max(.001,alpha);
 return vec4(rgb,alpha*smoothstep(.025,.18,alpha)*inside(q)*smoothstep(0.0,.035,b)*(1.0-smoothstep(.78,1.0,b)));
}
void main(){
 float k=info.x,w=info.y,seed=info.z,hits=info.w,t=motion.x*(1.0-motion.w),b=motion.y,charge=motion.z,reduced=motion.w;
 float popAge=reaction.x,oldHits=reaction.y,impactAge=reaction.z;
 vec2 p=(vUV-.5)*vec2(w+2.6,5.0)+vec2(0.0,-.7),point=p;
 float phase=t*.9+seed*.73;
 vec4 c=vec4(0.0);
 if(k>4.5&&k<5.5){
  // Basket and balloons are independently sampled from the painting. Popping
  // one balloon never replaces the pose or lighting of the remaining two.
  float drop=b<0.0?0.0:b*b*2.0;
  c=sprite(p+vec2(0.0,drop),vec2(0.0,-1.75),vec2(min(w*.62,2.3),1.35),pixels(760.0,950.0,370.0,270.0),0.0);
  if(b>=0.0)c.a*=1.0-smoothstep(.65,1.0,b);
  for(int i=0;i<3;i++){
   float n=float(i),bw=min(1.35,w*.38),bh=bw*1.22;
   vec2 center=vec2((n-1.0)*w*.28,.15-bh*.5-(i==1?0.0:.15));
   center.x+=sin(phase+n*1.7)*.045*(1.0-reduced);center.y+=sin(phase*.8+n)*.018*(1.0-reduced);
   float visible=step(n+.5,hits),popping=(1.0-visible)*step(n+.5,oldHits)*(1.0-smoothstep(.0,.18,popAge));
   if(b>=0.0){visible=0.0;popping=step(n+.5,hits)*(1.0-smoothstep(.0,.18,b*.85));}
   float swell=1.0+popping*.16;vec2 q=(p-center)/vec2(bw*swell,bh/swell)+.5;
   vec4 rect=i==0?pixels(680.0,700.0,230.0,280.0):i==1?pixels(831.0,645.0,225.0,310.0):pixels(1008.0,713.0,220.0,275.0);
   // Fill the occluded side from its clean half so the adjacent yellow balloon
   // can never leak into the red/cyan cutout.
   if(i==0)q.x=min(q.x,1.0-q.x);if(i==2)q.x=max(q.x,1.0-q.x);
   vec4 balloon=art(q,rect,0.0);float oval=length((q-.5)/vec2(.49,.49));balloon.a*=1.0-smoothstep(.96,1.02,oval);
   balloon.a*=max(visible,popping);balloon.rgb+=vec3(.3)*popping;c=over(balloon,c);
  }
 }else if(k>8.5&&k<9.5){
  c=sprite(p,vec2(0.0,artLayout.z),artLayout.xy,artRect,1.0);
  float lockX=(mod(seed,3.0)-1.0)*w*.22;
  vec2 lockPoint=p-vec2(lockX,.15);float pulse=1.0+.025*sin(t*3.0)*(1.0-reduced);
  vec4 lock=sprite(lockPoint,vec2(0.0),vec2(.52,.70)*pulse,pixels(225.0,995.0,180.0,220.0),1.0);c=over(lock,c);
 }else if(k>9.5&&k<10.5){
  float stepX=w/8.0,index=floor((p.x+w*.5)/stepX),present=bit(cellsInfo.x,clamp(index,0.0,7.0));
  float previous=bit(cellsInfo.y,clamp(index,0.0,7.0)),fade=(1.0-present)*previous*(1.0-smoothstep(.0,.12,cellsInfo.z));
  vec2 center=vec2((index+.5)*stepX-w*.5,-.12);
  c=sprite(p,center,vec2(stepX*1.02,max(.34,stepX*.98)),artRect,1.0);c.a*=max(present,fade)*step(0.0,index)*step(index,7.0);
  if(index==2.0||index==5.0)c.rgb=mix(c.rgb,vec3(1.0,.74,.18)*dot(c.rgb,vec3(.3,.6,.1))*1.5,.65);
  c.rgb+=vec3(.3,.9,1.0)*fade*.5;
 }else{
  if(k<.5)point.x+=sin(t*1.8+p.y*5.0+seed)*.018*smoothstep(-.3,.5,p.y)*(1.0-reduced);
  if(k>2.5&&k<3.5){point.x+=sin(t*1.2+p.y*4.0)*.025*(1.0-reduced);point.y+=sin(t*.85+p.x*2.0)*.02*(1.0-reduced);}
  if(k>3.5&&k<4.5)point.x+=sin(t*1.2+p.y*3.0)*.012*(1.0-reduced);
  if(k>5.5&&k<6.5){point.y+=sin(t*1.5+p.x*3.0)*.012*(1.0-reduced)+charge*.25*exp(-p.x*p.x);if(b>=0.0)point.x-=sign(p.x)*b*.8;}
  if(k>12.5&&k<13.5){point.x+=sin(p.y*4.0+t*1.6)*.035*(1.0-reduced);point.y+=sin(p.x*4.0+t*2.0)*.025*(1.0-reduced);if(b>=0.0){point.x/=1.0+b*.8;point.y=(point.y+.7)*(1.0+b*2.0)-.7;}}
  vec2 q=(point-vec2(0.0,artLayout.z))/artLayout.xy+.5;
  if(k<.5||k>2.5&&k<4.5||k>7.5&&k<8.5||k>10.5&&k<11.5||k>13.5)q.x=ledgeU(point.x,artLayout.x);
  c=art(q,artRect,artLayout.w);c.a*=step(abs(point.x),artLayout.x*.5);
  if(k>2.5&&k<3.5){float lightning=pow(max(c.r,c.b),3.0);c.rgb+=vec3(.4,.18,.6)*lightning*(.3+.3*sin(t*9.0))*(1.0-reduced);}
  if(k>7.5&&k<8.5){float line=.75+.25*sin(p.y*95.0-t*2.0);c.a*=.35*line;float scan=exp(-pow(fract(t*.3)*2.0-q.y-.5,2.0)*200.0);c.rgb+=vec3(.1,.5,.6)*scan;}
  if(k>11.5&&k<12.5){float bright=pow(max(c.b,c.g),3.0);c.rgb+=vec3(.08,.35,.5)*bright*(.4+.25*sin(t*3.0))*(1.0-reduced);}
  if(k>13.5){
   float group=mod(seed,3.0);vec3 tint=group<.5?vec3(.8,.3,1.0):group<1.5?vec3(1.0,.76,.22):vec3(.2,.95,1.0);c.rgb=mix(c.rgb,c.rgb*tint*1.7,.30);
   vec2 rune=(q-vec2(.515,.54))*artLayout.xy;float d=group<.5?abs(length(rune)-.10):group<1.5?abs(abs(rune.x)+abs(rune.y)-.14):max(min(abs(rune.x-.045),abs(rune.x+.045)),abs(rune.y)-.09);
   c.rgb+=tint*exp(-d*100.0)*(.9+.15*sin(t*2.0)*(1.0-reduced));
  }
 }
 float impact=exp(-max(0.0,impactAge)*22.0)*step(0.0,impactAge);c.rgb+=vec3(.18,.22,.25)*impact*reaction.w;
 if(k<.5&&hits>1.5){float seam=pow(max(0.0,sin(p.x*8.0+p.y*17.0)),30.0)*smoothstep(-.9,-.2,p.y);c.rgb*=1.0-seam*.35;}
 if(cue.a>0.0){float rim=exp(-abs(p.y-.15)*55.0)*(1.0-smoothstep(w*.4,w*.5,abs(p.x)));c=over(vec4(cue.rgb,rim*.8),c);}
 if(b>=0.0){
  if(k>4.5&&k<5.5){}else if(k>5.5&&k<6.5||k>7.5&&k<8.5||k>12.5&&k<13.5)c.a*=1.0-smoothstep(.25,1.0,b);
  else{c.a*=1.0-smoothstep(.015,.24,b);if(cellsInfo.w>=0.0){vec4 fx=burst(p,b,cellsInfo.w,w);if(k>10.5&&k<11.5)fx.rgb*=vec3(1.2,.38,.65);c=over(fx,c);}}
 }
 if(k>11.5&&k<12.5&&charge>.0&&b<0.0){
  vec2 f=p-vec2(0.0,-.5);float r=length(f*vec2(.8,1.0));float ring=exp(-abs(r-(.6+fract(t*.45)*.9))*65.0)*charge*.40*(1.0-smoothstep(1.0,1.6,r));c=over(vec4(.2,.85,1.0,ring),c);
 }
 gl_FragColor=vec4(c.rgb,clamp(c.a,0.0,1.0));
}`;

const resources=new WeakMap<Scene,{material:ShaderMaterial;textures:readonly Texture[]}>();
export function prepareSurfaceSkin(scene:Scene):ShaderMaterial {
  const cached=resources.get(scene);if(cached)return cached.material;
  const textures=SURFACE_ART_URLS.map((url,index)=>{
    const texture=new Texture(url,scene,true,true,Texture.BILINEAR_SAMPLINGMODE);
    texture.name=`SurfacePaintedAtlas${String(index)}`;texture.hasAlpha=true;texture.wrapU=texture.wrapV=Texture.CLAMP_ADDRESSMODE;return texture;
  });
  const material=new ShaderMaterial("SurfaceMaterial",scene,{vertexSource:vertex,fragmentSource:fragment},{
    attributes:["position","uv"],uniforms:["worldViewProjection","info","motion","artLayout","artRect","reaction","cellsInfo","cue","breakFrames"],
    samplers:["skyArt","specialArt","crystalArt","breakArt"],needAlphaBlending:true,
  });
  const names=["skyArt","specialArt","crystalArt","breakArt"];textures.forEach((texture,i)=>material.setTexture(names[i]??"skyArt",texture));
  material.backFaceCulling=false;material.disableDepthWrite=true;
  material.onBindObservable.add(mesh=>{
    const p=(mesh.metadata as {surface:Paint}).surface,e=material.getEffect();
    e.setFloat4("info",p.kind,p.width,p.seed,p.hits);e.setFloat4("motion",p.time,p.broken,p.charge,p.reduced?1:0);
    e.setFloat4("artLayout",p.layout[0]??1,p.layout[1]??1,p.layout[2]??0,p.layout[3]??0);
    e.setFloat4("artRect",p.rect[0]??0,p.rect[1]??0,p.rect[2]??1,p.rect[3]??1);
    e.setFloat4("reaction",p.time-p.popAt,p.previousHits,p.time-p.impactAt,p.force);
    e.setFloat4("cellsInfo",p.cells,p.previousCells,p.time-p.cellsAt,p.burst);e.setFloat4("cue",p.cue[0]??0,p.cue[1]??0,p.cue[2]??0,p.cue[3]??0);
    e.setFloat3("breakFrames",p.frames[0]??0,p.frames[1]??0,p.frames[2]??0);
  });
  resources.set(scene,{material,textures});material.onDisposeObservable.addOnce(()=>resources.delete(scene));return material;
}
export function surfaceArtTextures(scene:Scene):readonly Texture[]{prepareSurfaceSkin(scene);return resources.get(scene)?.textures??[];}

/** One painted quad and shared GPU atlases per pooled slot, no per-frame meshes. */
export class SurfaceSkin {
  readonly mesh:Mesh;
  readonly #paint:Paint={kind:0,width:3,seed:0,hits:1,cells:255,previousCells:255,time:0,broken:-1,charge:0,reduced:false,burst:0,
    popAt:-Infinity,previousHits:1,cellsAt:-Infinity,impactAt:-Infinity,force:1,rect:[0,0,1,1],layout:[1,1,0,0],cue:[.2,.8,1,0],frames:[0,0,0]};
  #shapeKey="";
  public constructor(private readonly parent:Mesh,scene:Scene){
    this.mesh=MeshBuilder.CreatePlane(`${parent.name}-surface`,{width:1,height:5},scene);this.mesh.parent=parent;this.mesh.position.z=-.65;this.mesh.position.y=-.7;
    this.mesh.isPickable=false;this.mesh.material=prepareSurfaceSkin(scene);this.mesh.metadata={surface:this.#paint};this.mesh.setEnabled(false);
  }
  public hide():void{this.mesh.setEnabled(false);}
  public reset():void{
    this.hide();this.#shapeKey="";Object.assign(this.#paint,{impactAt:-Infinity,popAt:-Infinity,cellsAt:-Infinity,previousHits:1,previousCells:255});
    this.mesh.position.y=-.7;this.mesh.rotation.z=0;
  }
  public impact(time:number,force:number):void{this.#paint.impactAt=time;this.#paint.force=force;}
  public render(surface:PlatformSurface,width:number,seed:number,state:SurfaceState,approach:ApproachState|null,time:number,reduced:boolean,broken=-1):void{
    const p=this.#paint,art=SURFACE_ART[surface];if(!art){this.hide();return;}
    const key=`${surface}:${String(width)}:${String(seed)}`;
    if(key!==this.#shapeKey){p.rect=surfaceUVRect(art.rect);p.layout=surfaceArtLayout(art,width);p.burst=art.burst;
      p.hits=state.hits;p.cells=state.cells;p.previousHits=state.hits;p.previousCells=state.cells;this.#shapeKey=key;}
    if(state.hits!==p.hits){p.previousHits=p.hits;p.popAt=time;}
    if(state.cells!==p.cells){p.previousCells=p.cells;p.cellsAt=time;}
    Object.assign(p,{kind:SURFACES.indexOf(surface),width,seed,hits:state.hits,cells:state.cells,time,charge:state.charge,reduced,broken});
    if(broken>=0)p.frames=reduced?[1,1,0]:surfaceBreakFrames(broken);
    p.cue=approach==="danger"?[1,.12,.25,1]:approach==="boost"?[1,.65,.08,1]:[.15,.85,1,0];
    this.mesh.scaling.x=(width+2.6)/Math.max(.01,this.parent.scaling.x);this.mesh.setEnabled(true);
    const motion=platformImpactMotion(broken>=0?broken:time-p.impactAt,p.force,reduced);this.mesh.position.y=motion.y-.7;this.mesh.rotation.z=motion.rotation;
  }
}
