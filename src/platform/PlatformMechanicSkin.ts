import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { Scene } from "@babylonjs/core/scene";
import type { PlatformMechanic } from "./PlatformMechanic";
import type { ApproachState } from "./PlatformReadability";
import { SurfaceSkin, prepareSurfaceSkin } from "./SurfaceSkin";
export const prepareMechanicSkin=prepareSurfaceSkin;
const STATE={hits:1,cells:255,charge:0,infection:0};
/** Every machine variant uses the same detailed six-frame painted rig. The
 * turbine rotor and turret barrel stay independently animated/aimed. */
export class PlatformMechanicSkin{
 readonly body:Mesh;readonly part:Mesh;
 readonly #bodySkin:SurfaceSkin;readonly #partSkin:SurfaceSkin;
 #kind:PlatformMechanic="moving";#width=3;#state:ApproachState|null=null;#time=0;#reduced=false;#aim:{x:number;y:number}|null=null;
 public constructor(private readonly parent:Mesh,height:number,depth:number,scene:Scene){
  this.#bodySkin=new SurfaceSkin(parent,scene,"machine-body",0,height/2);this.#partSkin=new SurfaceSkin(parent,scene,"machine-part",1,height/2);
  this.body=this.#bodySkin.mesh;this.part=this.#partSkin.mesh;this.body.position.z=-depth/2-.06;this.part.position.z=this.body.position.z-.03;
 }
 public reset():void{this.#aim=null;this.#bodySkin.reset();this.#partSkin.reset();}
 public render(kind:PlatformMechanic,width:number,state:ApproachState|null,elapsed:number,reduced:boolean):void{
  this.#kind=kind;this.#width=width;this.#state=state;this.#time=elapsed;this.#reduced=reduced;
  this.#bodySkin.render(kind,width,0,STATE,state,elapsed,reduced);
  Object.assign(this.body.metadata as object,{mechanic:kind,silhouette:kind==="moving"?"thruster-carriage":kind==="turret"?"armored-cannon":"turbine-grille"});
  if(kind==="moving"){this.#partSkin.hide();return;}
  this.#partSkin.render(kind,width,0,STATE,state,elapsed,reduced);this.#updateAim();
 }
 #updateAim():void{
  const angle=this.#kind==="turret"?this.#aim?-Math.atan2(this.#aim.x-this.parent.position.x,this.#aim.y-this.parent.position.y):0:this.#reduced?0:this.#time*8*(this.#kind==="wind-left"?-1:1);
  this.#partSkin.aim(angle);
 }
 public aim(x:number,y:number):void{if(this.#kind==="turret"){this.#aim={x,y};this.#updateAim();}}
 public renderBreak(progress:number):void{
  this.#partSkin.hide();this.#bodySkin.render(this.#kind,this.#width,0,STATE,this.#state,this.#time+progress,this.#reduced,progress);
 }
 public hide():void{this.#bodySkin.hide();this.#partSkin.hide();}
}
