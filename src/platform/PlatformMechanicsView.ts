import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import type { Scene } from "@babylonjs/core/scene";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { LinesMesh } from "@babylonjs/core/Meshes/linesMesh";
import { getRenderQuality } from "../rendering/AdaptiveQuality";
import type { PlatformMechanics } from "./PlatformMechanics";

interface Marker {root:TransformNode;arrow:LinesMesh;aim:LinesMesh;field:LinesMesh;points:Vector3[];ray:Vector3[];lines:Vector3[][]}
const MOVE_ARROW=[[-.5,0],[-.25,.2],[-.5,0],[.5,0],[.25,.2],[.5,0],[.25,-.2]];
const WIND_ARROW=[[-.45,0],[.45,0],[.1,.25],[.45,0],[.1,-.25],[.45,0],[-.45,0]];
/** Bodies belong to the platform pool. This bounded overlay shows space affected
 * by machines: stationary rails, flowing air and a fixed turret warning line. */
export class PlatformMechanicsView {
  readonly #markers:Marker[]=[];
  readonly #shots:{mesh:Mesh;tail:LinesMesh;points:Vector3[]}[]=[];
  readonly #material:StandardMaterial;
  readonly #reduced=typeof matchMedia==="function"&&matchMedia("(prefers-reduced-motion: reduce)").matches;
  public constructor(private readonly scene:Scene,private readonly model:PlatformMechanics) {
    this.#material=new StandardMaterial("PlatformMechanicGlow",scene);
    this.#material.disableLighting=true;this.#material.emissiveColor.set(1,.12,.55);
    for(let i=0;i<8;i++) {
      const root=new TransformNode(`PlatformMechanic-${String(i)}`,scene);
      const points=Array.from({length:7},()=>Vector3.Zero()),ray=[Vector3.Zero(),Vector3.Zero()];
      const arrow=MeshBuilder.CreateLines(`PlatformMechanicArrow-${String(i)}`,{points,updatable:true},scene);
      arrow.parent=root;arrow.isPickable=false;
      const aim=MeshBuilder.CreateLines(`PlatformTurretAim-${String(i)}`,{points:ray,updatable:true},scene);
      aim.color.set(1,.2,.45);aim.isPickable=false;aim.setEnabled(false);root.setEnabled(false);
      const lines=Array.from({length:3},()=>Array.from({length:6},()=>Vector3.Zero()));
      const field=MeshBuilder.CreateLineSystem(`PlatformMachineField-${String(i)}`,{lines,updatable:true},scene);
      field.isPickable=false;field.setEnabled(false);
      this.#markers.push({root,arrow,aim,field,points,ray,lines});
    }
    for(let i=0;i<model.projectiles.length;i++) {
      const mesh=MeshBuilder.CreateSphere(`PlatformProjectile-${String(i)}`,{diameter:.45,segments:8},scene);
      mesh.material=this.#material;mesh.isPickable=false;mesh.setEnabled(false);
      const points=[Vector3.Zero(),Vector3.Zero()];
      const tail=MeshBuilder.CreateLines(`PlatformProjectileTail-${String(i)}`,{points,updatable:true},scene);
      tail.color.set(1,.75,.95);tail.isPickable=false;tail.setEnabled(false);
      this.#shots.push({mesh,tail,points});
    }
  }
  public fixedUpdate():void {
    const low=getRenderQuality(this.scene.getEngine())==="low";
    this.#markers.forEach((marker,i)=>{
      const cue=this.model.cues[i];
      marker.root.setEnabled(cue!==undefined);marker.aim.setEnabled(false);marker.field.setEnabled(false);
      if(!cue)return;
      const position=cue.platform.mesh.position,turret=cue.kind==="turret",moving=cue.kind==="moving",wind=cue.kind.startsWith("wind");
      marker.root.position.set(position.x,position.y+1.05,position.z-.9);
      marker.arrow.isVisible=!turret;
      const direction=cue.kind==="wind-left"?-1:1,shape=moving?MOVE_ARROW:WIND_ARROW;
      shape.forEach((p,j)=>marker.points[j]?.set((p[0]??0)*direction,p[1]??0,0));
      MeshBuilder.CreateLines("",{points:marker.points,instance:marker.arrow});
      marker.arrow.color.set(moving?.6:.05,moving?.75:1,moving?1:.8);
      if(moving||wind) {
        marker.lines.forEach((line,row)=>{line.forEach((point,j)=>{
          if(moving) {
            const half=cue.platform.width/2+(cue.platform.lateralMotion?.amplitude??.9);
            point.set((cue.platform.motionCenterX??position.x)-half+2*half*j/5,position.y-.25-row*.12,position.z-.1);
          } else {
            const flow=this.#reduced||low?0:(this.model.age*1.5)%1;
            const x=(j+flow)/5;
            point.set(position.x+direction*(.25+x*3.4),position.y+.3+row*.32+(this.#reduced?0:Math.sin(x*5-this.model.age*5+row)*.08),position.z-.9);
          }
        });});
        MeshBuilder.CreateLineSystem("",{lines:marker.lines,instance:marker.field});
        marker.field.color.set(moving?.3:.05,moving?.5:.95,moving?1:.7);
        marker.field.alpha=moving?.65:.45+cue.charge*.4;marker.field.setEnabled(true);
      }
      if(turret&&cue.charge>0) {
        marker.ray[0]?.set(position.x,position.y+.6,position.z-.9);
        marker.ray[1]?.set(cue.aimX,cue.aimY,position.z-.9);
        MeshBuilder.CreateLines("",{points:marker.ray,instance:marker.aim});
        marker.aim.alpha=.3+cue.charge*.6;marker.aim.setEnabled(true);
      }
    });
    this.#shots.forEach((view,i)=>{
      const shot=this.model.projectiles[i],active=shot?.active===true;
      view.mesh.setEnabled(active);view.tail.setEnabled(active&&!low);if(!shot||!active)return;
      view.mesh.position.set(shot.x,shot.y,-.8);
      view.points[0]?.set(shot.x-shot.vx*.06,shot.y-shot.vy*.06,-.8);
      view.points[1]?.set(shot.x,shot.y,-.8);
      MeshBuilder.CreateLines("",{points:view.points,instance:view.tail});
    });
  }
  public dispose():void {
    for(const marker of this.#markers){marker.root.dispose();marker.aim.dispose();marker.field.dispose();}
    for(const shot of this.#shots){shot.mesh.dispose();shot.tail.dispose();}
    this.#material.dispose();this.model.clear();
  }
}
