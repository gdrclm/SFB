import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { VertexBuffer } from "@babylonjs/core/Buffers/buffer";
import { ShaderMaterial } from "@babylonjs/core/Materials/shaderMaterial";
import type { Scene } from "@babylonjs/core/scene";
import type { SurfaceInteractions } from "./SurfaceInteractions";
import { surfaceArtTextures } from "./SurfaceSkin";
const kinds=["shock","shard","puddle","feather","bird","wave","rift","earth","gust"];
/** All surface warnings, pickups and detached hazards render as one fixed batch. */
export class SurfaceFXView {
 readonly #mesh:Mesh;readonly #material:ShaderMaterial;
 readonly #positions=new Float32Array(32*12);readonly #data=new Float32Array(32*16);
 public constructor(scene:Scene,private readonly system:SurfaceInteractions){
  this.#mesh=new Mesh("SurfaceEvents",scene);const vertices=new VertexData(),uvs:number[]=[],indices:number[]=[];
  for(let i=0;i<32;i++){uvs.push(0,0,1,0,1,1,0,1);const n=i*4;indices.push(n,n+1,n+2,n,n+2,n+3);}
  vertices.positions=this.#positions;vertices.uvs=uvs;vertices.indices=indices;vertices.applyToMesh(this.#mesh,true);
  this.#mesh.setVerticesData("eventData",this.#data,true,4);this.#mesh.isPickable=false;
  this.#material=new ShaderMaterial("SurfaceEventsMaterial",scene,{vertexSource:`precision highp float;attribute vec3 position;attribute vec2 uv;attribute vec4 eventData;uniform mat4 worldViewProjection;varying vec2 vUV;varying vec4 vEvent;void main(){vUV=uv;vEvent=eventData;gl_Position=worldViewProjection*vec4(position,1.0);}`,
   fragmentSource:`precision highp float;varying vec2 vUV;varying vec4 vEvent;uniform sampler2D crystalArt;uniform sampler2D breakArt;
   float inside(vec2 q){return step(0.0,q.x)*step(q.x,1.0)*step(0.0,q.y)*step(q.y,1.0);}
   void main(){vec2 p=vUV*2.0-1.0;float r=length(p),k=vEvent.x,t=vEvent.y,a=0.0;vec3 c=vec3(.2,.9,1.0);
    if(k<.5){float warning=step(t,.5);a=exp(-abs(r-(warning>.5?.85:.55+t*.35))*45.0);a+=warning*.12*(1.0-smoothstep(.8,1.0,r));
     if(warning<.5&&vEvent.z>.5)a+=pow(abs(sin(atan(p.y,p.x)*6.0)),28.0)*smoothstep(.1,.4,r)*(1.0-smoothstep(.8,1.0,r))*.8;
     c=warning>.5?vec3(1.0,.64,.10):vec3(1.0,.1,.25);}
    else if(k<1.5){float angle=t*(3.0+vEvent.z);vec2 q=mat2(cos(angle),-sin(angle),sin(angle),cos(angle))*p*.5+.5;
     vec4 chip=texture2D(crystalArt,(vec2(1080.0,64.0)+clamp(q,0.0,1.0)*vec2(135.0,130.0))/1254.0);
     a=chip.a*inside(q);c=mix(chip.rgb,vec3(1.0,.18,.4)*max(.4,max(chip.r,chip.b)),.55);}
    else if(k<2.5){vec2 q=p*vec2(.5,1.3)+.5;vec4 pool=texture2D(crystalArt,(vec2(0.0,34.0)+clamp(q,0.0,1.0)*vec2(627.0,490.0))/1254.0);a=pool.a*inside(q)*.85;c=pool.rgb;}
    else if(k<3.5){float stem=exp(-abs(p.x-p.y*.2)*45.0);float vane=(1.0-smoothstep(.45,.65,length(p*vec2(1.5,.7))))*.7;a=max(stem,vane);c=vec3(1.0,.86,.40);}
    else if(k<4.5){float wing=abs(p.y-abs(p.x)*(.15+sin(t*35.0)*.5));a=exp(-wing*35.0)*(1.0-smoothstep(.7,1.0,abs(p.x)));c=vec3(.65,.85,1.0);}
    else if(k<5.5){a=exp(-abs(r-t)*50.0)*(1.0-t);c=vec3(.7,.5,1.0);}
    else if(k<6.5){a=exp(-abs(p.y-sin(p.x*31.0+t*9.0)*.05)*35.0);c=vec3(.6,.15,1.0)+vec3(.2,.7,.0)*exp(-abs(p.y)*50.0);}
    else if(k<7.5){float angle=t*(vEvent.z+1.0);vec2 q=mat2(cos(angle),-sin(angle),sin(angle),cos(angle))*p*.5+.5;
     vec4 turf=texture2D(breakArt,(vec2(3.0,3.0)+clamp(q,.01,.99))/4.0);a=turf.a*inside(q);c=turf.rgb;}
    else{vec2 q=vec2(p.x*vEvent.z,p.y);float bands=exp(-abs(fract(q.y*3.0)-.5)*35.0);a=bands*(1.0-smoothstep(.45,.95,abs(q.x-t*.5)))*(1.0-smoothstep(.5,.8,abs(q.y)));c=vec3(.7,.97,1.0);}
    gl_FragColor=vec4(c,clamp(a*smoothstep(.025,.16,a)*(1.0-smoothstep(.8,1.0,t)),0.0,1.0));}`},
   {attributes:["position","uv","eventData"],uniforms:["worldViewProjection"],samplers:["crystalArt","breakArt"],needAlphaBlending:true});
  const textures=surfaceArtTextures(scene),crystal=textures[2],breaks=textures[3];
  if(crystal)this.#material.setTexture("crystalArt",crystal);if(breaks)this.#material.setTexture("breakArt",breaks);
  this.#material.backFaceCulling=false;this.#material.disableDepthWrite=true;this.#mesh.material=this.#material;
 }
 public fixedUpdate():void{
  this.#positions.fill(0);let count=0;
  for(const e of this.system.events)if(e.active){
   const i=count++,r=e.radius,x=e.x,y=e.y,o=i*12;
   const kind=kinds.indexOf(e.kind),age=e.age/e.life;
   for(let v=0;v<4;v++){
    const p=o+v*3,d=i*16+v*4;
    this.#positions[p]=v===0||v===3?x-r:x+r;this.#positions[p+1]=v<2?y-r:y+r;this.#positions[p+2]=-.9;
    this.#data[d]=kind;this.#data[d+1]=age;this.#data[d+2]=e.seed;this.#data[d+3]=e.delay;
   }
  }
  this.#mesh.setEnabled(count>0);if(!count)return;
  this.#mesh.updateVerticesData(VertexBuffer.PositionKind,this.#positions);this.#mesh.updateVerticesData("eventData",this.#data);this.#mesh.refreshBoundingInfo();
 }
 public dispose():void{this.#mesh.dispose();this.#material.dispose();}
}
