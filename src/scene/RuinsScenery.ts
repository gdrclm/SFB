import {Constants} from "@babylonjs/core/Engines/constants";
import {Color3} from "@babylonjs/core/Maths/math.color";
import {Vector4} from "@babylonjs/core/Maths/math.vector";
import {Plane} from "@babylonjs/core/Maths/math.plane";
import {StandardMaterial} from "@babylonjs/core/Materials/standardMaterial";
import {Material} from "@babylonjs/core/Materials/material";
import {Texture} from "@babylonjs/core/Materials/Textures/texture";
import {Mesh} from "@babylonjs/core/Meshes/mesh";
import {MeshBuilder} from "@babylonjs/core/Meshes/meshBuilder";
import {VertexData} from "@babylonjs/core/Meshes/mesh.vertexData";
import type {Scene} from "@babylonjs/core/scene";
import {sceneryY} from "./BackdropMotion";
import {sceneryTexture} from "./SceneTextures";
import {RUINS_ARCHES,RUINS_PROPS,RUINS_CAGES,RUINS_TORCHES,RUINS_ATLAS_SIZE} from "./RuinsSceneryLayout";
import ruinsAtlasUrl from "../assets/worlds/ruins-scenery-atlas.png";

interface Card{mesh:Mesh;x:number;anchor:number;rate:number;copy:number;kind:"stone"|"cage"|"glow"|"flame"|"ember";phase:number;scale:number}
class Shapes{
 readonly positions:number[]=[];readonly colors:number[]=[];readonly indices:number[]=[];
 public polygon(points:readonly (readonly [number,number])[],color:readonly[number,number,number],alpha=1):void{
  const n=this.positions.length/3;
  for(const [x,y]of points){this.positions.push(x,y,0);this.colors.push(...color,alpha);}
  for(let i=1;i<points.length-1;i++)this.indices.push(n,n+i,n+i+1);
 }
 public box(x:number,y:number,w:number,h:number,color:readonly[number,number,number],alpha=1):void{
  this.polygon([[x-w/2,y-h/2],[x+w/2,y-h/2],[x+w/2,y+h/2],[x-w/2,y+h/2]],color,alpha);
 }
 public mesh(name:string,scene:Scene):Mesh{
  const mesh=new Mesh(name,scene),data=new VertexData();
  data.positions=this.positions;data.colors=this.colors;data.indices=this.indices;
  const normals:number[]=[];VertexData.ComputeNormals(this.positions,this.indices,normals);data.normals=normals;data.applyToMesh(mesh);
  mesh.hasVertexAlpha=true;return mesh;
 }
}

/** Torch-lit ruins supplement the baked illustration with depth, warm haze,
 * swinging ironwork and drifting embers. Every mesh/material is allocated once. */
export class RuinsScenery{
 readonly #cards:Card[]=[];
 readonly #materials:StandardMaterial[]=[];
 readonly #top=new Plane(0,1,0,0);
 readonly #bottom=new Plane(0,-1,0,0);
 #atlas:Texture|null=null;
 #atlasFailed=false;
 #time=0;
 #disposed=false;
 public constructor(private readonly scene:Scene,private readonly parent:Mesh,atlasUrl:string|null=ruinsAtlasUrl){
  const glow=this.#material("RuinsTorchGlow",new Color3(1,.35,.055));
  glow.alphaMode=Constants.ALPHA_ADD;glow.disableDepthWrite=true;
  if(atlasUrl)this.#addAtlas(atlasUrl);
  else{
   const far=this.#material("RuinsDistantMasonry",new Color3(.20,.15,.12));far.alpha=.60;
   const iron=this.#material("RuinsIronwork",new Color3(.72,.45,.25));this.#addArches(far);this.#addCages(iron);
  }
  this.#addTorches(glow,atlasUrl===null);this.#addEmbers(glow);
  parent.onDisposeObservable.addOnce(()=>{this.dispose();});
 }
 #material(name:string,color:Color3):StandardMaterial{
  const material=new StandardMaterial(name,this.scene);material.disableLighting=true;
  material.emissiveColor=color;material.diffuseColor=Color3.White();material.specularColor=Color3.Black();
  material.backFaceCulling=false;material.useAlphaFromDiffuseTexture=true;material.disableDepthWrite=true;
  material.transparencyMode=Material.MATERIAL_ALPHABLEND;
  material.clipPlane=this.#top;material.clipPlane2=this.#bottom;this.#materials.push(material);return material;
 }
 #card(mesh:Mesh,material:StandardMaterial,x:number,anchor:number,rate:number,copy:number,kind:Card["kind"],phase=0,scale=1):void{
  mesh.parent=this.parent;mesh.material=material;mesh.isPickable=false;
  mesh.position.set(x,anchor,-.03-rate*.15);mesh.scaling.setAll(scale);
  mesh.alphaIndex=-280+Math.round(rate*100);
  this.#cards.push({mesh,x,anchor,rate,copy,kind,phase,scale});
 }
 #addArches(material:StandardMaterial):void{
  const shape=new Shapes(),stone=[.34,.25,.19] as const,edge=[.43,.30,.20] as const;
  // A complete pointed arch, with an open centre, remains a background silhouette.
  for(const side of [-1,1]){
   shape.box(side*1.68,-.6,.62,7.0,stone);
   for(let y=-3.6;y<2.5;y+=.78){shape.box(side*1.68,y,.82,.10,edge);shape.box(side*1.72,y+.35,.58,.025,[.12,.09,.075]);}
   shape.polygon([[side*1.37,2.5],[side*1.99,2.5],[side*.78,4.25],[0,4.65],[0,4.02],[side*.55,3.7]],stone);
   shape.polygon([[side*1.36,2.5],[side*1.48,2.5],[side*.58,3.92],[0,4.3],[0,4.12],[side*.5,3.78]],edge);
  }
  shape.box(0,-4.12,4.6,.44,stone);
  for(const [i,arch]of RUINS_ARCHES.entries())for(const copy of [0,1]){
   this.#card(shape.mesh(`RuinsArch-${String(i)}-${String(copy)}`,this.scene),material,arch.x,arch.anchor,arch.rate,copy,"stone",0,arch.scale);
  }
 }
 #addCages(material:StandardMaterial):void{
  const shape=new Shapes(),dark=[.11,.085,.07] as const,rim=[.44,.28,.15] as const;
  // Linked chain down to a tapered hanging cage; warm highlights stay on one edge.
  for(let i=0;i<18;i++){
   const y=-i*.22,w=i%2?.12:.21;
   shape.box(-w/2,y,.025,.16,dark);shape.box(w/2,y,.025,.16,rim);
   shape.box(0,y+.08,w,.025,rim);shape.box(0,y-.08,w,.025,dark);
  }
  shape.polygon([[-.75,-4.2],[0,-3.7],[.75,-4.2]],dark);
  shape.box(0,-4.24,1.65,.12,rim);shape.box(0,-5.72,1.35,.14,rim);
  for(let i=0;i<6;i++){const x=(i/5-.5)*1.22;shape.box(x,-4.99,.055,1.36,i<3?dark:rim);}
  for(const side of [-1,1])shape.polygon([[side*.82,-4.22],[side*.70,-5.78],[side*.58,-5.78],[side*.70,-4.22]],dark);
  for(const [i,cage]of RUINS_CAGES.entries())for(const copy of [0,1]){
   this.#card(shape.mesh(`RuinsCage-${String(i)}-${String(copy)}`,this.scene),material,cage.x,cage.anchor,cage.rate,copy,"cage",cage.phase,cage.scale);
  }
 }
 #glowMesh(name:string):Mesh{
  const shape=new Shapes(),rings=5,segments=24;
  for(let ring=0;ring<rings;ring++){
   const inner=ring/rings,outer=(ring+1)/rings;
   const ai=(1-inner*inner)**2*.22,ao=(1-outer*outer)**2*.22;
   for(let i=0;i<segments;i++){
    const a=i/segments*Math.PI*2,b=(i+1)/segments*Math.PI*2,n=shape.positions.length/3;
    for(const [radius,angle,alpha]of [[inner,a,ai],[outer,a,ao],[outer,b,ao],[inner,b,ai]]){
     shape.positions.push(Math.cos(angle??0)*(radius??0),Math.sin(angle??0)*(radius??0),0);shape.colors.push(1,.72,.35,alpha??0);
    }
    shape.indices.push(n,n+1,n+2,n,n+2,n+3);
   }
  }
  return shape.mesh(name,this.scene);
 }
 #addTorches(material:StandardMaterial,flames:boolean):void{
  const shape=new Shapes();
  shape.polygon([[-.10,-.20],[-.24,.09],[-.08,.32],[.01,.77],[.12,.39],[.23,.10],[.14,-.19]],[1,.49,.10],.9);
  shape.polygon([[-.055,-.18],[-.10,.05],[.04,.37],[.11,.06],[.055,-.18]],[1,.92,.52]);
  for(const [i,torch]of RUINS_TORCHES.entries())for(const copy of [0,1]){
   this.#card(this.#glowMesh(`RuinsTorchHalo-${String(i)}-${String(copy)}`),material,torch.x,torch.anchor,torch.rate,copy,"glow",torch.phase,2.7);
   if(flames)this.#card(shape.mesh(`RuinsTorchFlame-${String(i)}-${String(copy)}`,this.scene),material,torch.x,torch.anchor,torch.rate,copy,"flame",torch.phase,.72);
  }
 }
 #addEmbers(material:StandardMaterial):void{
  const shape=new Shapes();shape.polygon([[0,.12],[-.048,0],[0,-.08],[.048,0]],[1,.69,.23],.8);
  for(let i=0;i<10;i++){
   const side=i%2?-1:1,seed=(i*.618+.2)%1;
   this.#card(shape.mesh(`RuinsEmber-${String(i)}`,this.scene),material,side*(7+seed*5.5),-20+seed*40,.23+seed*.30,0,"ember",i*1.71,.45+seed*.55);
  }
 }
 #addAtlas(url:string):void{
  const material=this.#material("RuinsWholeLedges",Color3.White());
  this.#atlas=sceneryTexture(url,this.scene,()=>{this.#atlasFailed=true;material.alpha=0;});
  this.#atlas.hasAlpha=true;this.#atlas.wrapU=this.#atlas.wrapV=Texture.CLAMP_ADDRESSMODE;material.diffuseTexture=this.#atlas;
  for(const [i,prop]of RUINS_PROPS.entries()){
   const [left,top,right,bottom]=prop.bounds,[atlasWidth,atlasHeight]=RUINS_ATLAS_SIZE;
   const uv=new Vector4(left/atlasWidth,1-bottom/atlasHeight,right/atlasWidth,1-top/atlasHeight);
   const width=prop.height*(right-left)/(bottom-top);
   for(const copy of [0,1]){
    const mesh=MeshBuilder.CreatePlane(`RuinsProp-${prop.name}-${String(copy)}`,{width,height:prop.height,sideOrientation:Mesh.DOUBLESIDE,frontUVs:uv,backUVs:uv},this.scene);
    this.#card(mesh,material,prop.x,prop.anchor,prop.rate,copy,prop.kind,i*.7);mesh.visibility=prop.opacity;
   }
  }
 }
 public isReady():boolean{return this.#atlas===null||this.#atlasFailed||this.#atlas.loadingError||this.#atlas.isReady();}
 public update(cameraTravel:number,cameraX:number,worldCenterY:number,height:number,reduced:boolean,realSeconds=0):void{
  const dt=Number.isFinite(realSeconds)?Math.max(0,Math.min(.1,realSeconds)):0;this.#time+=dt;
  this.#top.d=-(worldCenterY+height/2);this.#bottom.d=worldCenterY-height/2;
  const travel=reduced?cameraTravel*.2:cameraTravel;
  for(const card of this.#cards){
   const ember=card.kind==="ember",rise=ember?this.#time*(.5+card.scale*.4)*(reduced?.2:1):0;
   const y=sceneryY(card.anchor+rise,travel,card.rate);
   card.mesh.position.y=y+(card.copy===0?0:y>0?-42:42);
   const lateral=reduced?0:Math.max(-1.2,Math.min(1.2,cameraX*card.rate*.35/Math.max(.001,this.parent.scaling.x)));
   const x=card.x-lateral;
   card.mesh.position.x=card.x<0?Math.min(card.x,x):Math.max(card.x,x);
   const pulse=reduced?1:1+Math.sin(this.#time*5.3+card.phase)*.09+Math.sin(this.#time*9.7+card.phase*2.1)*.04;
   if(card.kind==="glow")card.mesh.visibility=pulse*.72;
   if(card.kind==="flame")card.mesh.scaling.y=card.scale*(reduced?1:pulse);
   if(card.kind==="cage")card.mesh.rotation.z=reduced?0:Math.sin(this.#time*.62+card.phase)*.022;
   if(ember){
    card.mesh.position.x+=reduced?0:Math.sin(this.#time*.6+card.phase)*.16;
    card.mesh.visibility=(reduced?.10:.24)*(1-Math.min(1,Math.max(0,(Math.abs(y)-18)/3)))*(.65+Math.sin(this.#time*.7+card.phase)*.25);
   }
  }
 }
 public dispose():void{
  if(this.#disposed)return;this.#disposed=true;
  for(const card of this.#cards)card.mesh.dispose();
  for(const material of this.#materials)material.dispose(false,true);
 }
}
