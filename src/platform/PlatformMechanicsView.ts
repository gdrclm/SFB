import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import type { Scene } from "@babylonjs/core/scene";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { LinesMesh } from "@babylonjs/core/Meshes/linesMesh";
import { getRenderQuality } from "../rendering/AdaptiveQuality";
import type { PlatformMechanics } from "./PlatformMechanics";

interface Marker { root: TransformNode; arrow: LinesMesh; ring: Mesh; barrel: Mesh; aim: LinesMesh; points: Vector3[]; ray: Vector3[] }
const MOVE_ARROW=[[-.5,0],[-.25,.2],[-.5,0],[.5,0],[.25,.2],[.5,0],[.25,-.2]];
const WIND_ARROW=[[-.45,0],[.45,0],[.1,.25],[.45,0],[.1,-.25],[.45,0],[-.45,0]];
export class PlatformMechanicsView {
  readonly #markers: Marker[]=[];
  readonly #shots: { mesh: Mesh; tail: LinesMesh; points: Vector3[] }[]=[];
  readonly #material: StandardMaterial;
  readonly #reduced=typeof matchMedia==="function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  public constructor(private readonly scene: Scene, private readonly model: PlatformMechanics) {
    this.#material=new StandardMaterial("PlatformMechanicGlow",scene);
    this.#material.disableLighting=true;this.#material.emissiveColor.set(1,.12,.55);
    for(let i=0;i<8;i++) {
      const root=new TransformNode(`PlatformMechanic-${String(i)}`,scene);
      const points=Array.from({length:7},()=>Vector3.Zero()),ray=[Vector3.Zero(),Vector3.Zero()];
      const arrow=MeshBuilder.CreateLines(`PlatformMechanicArrow-${String(i)}`,{points,updatable:true},scene);
      arrow.parent=root;arrow.isPickable=false;
      const ring=MeshBuilder.CreateTorus(`PlatformTurretRing-${String(i)}`,{diameter:.55,thickness:.065,tessellation:12},scene);
      ring.parent=root;ring.rotation.x=Math.PI/2;ring.material=this.#material;ring.isPickable=false;
      const barrel=MeshBuilder.CreateCylinder(`PlatformTurretBarrel-${String(i)}`,{height:.48,diameter:.16,tessellation:8},scene);
      barrel.parent=root;barrel.material=this.#material;barrel.isPickable=false;
      const aim=MeshBuilder.CreateLines(`PlatformTurretAim-${String(i)}`,{points:ray,updatable:true},scene);
      aim.color.set(1,.2,.45);aim.isPickable=false;aim.setEnabled(false);root.setEnabled(false);
      this.#markers.push({root,arrow,ring,barrel,aim,points,ray});
    }
    for(let i=0;i<model.projectiles.length;i++) {
      const mesh=MeshBuilder.CreateSphere(`PlatformProjectile-${String(i)}`,{diameter:.36,segments:8},scene);
      mesh.material=this.#material;mesh.isPickable=false;mesh.setEnabled(false);
      const points=[Vector3.Zero(),Vector3.Zero()];
      const tail=MeshBuilder.CreateLines(`PlatformProjectileTail-${String(i)}`,{points,updatable:true},scene);
      tail.color.set(1,.75,.95);tail.isPickable=false;tail.setEnabled(false);
      this.#shots.push({mesh,tail,points});
    }
  }
  public fixedUpdate(): void {
    const low=getRenderQuality(this.scene.getEngine())==="low";
    this.#markers.forEach((marker,i)=>{
      const cue=this.model.cues[i];
      marker.root.setEnabled(cue!==undefined);marker.aim.setEnabled(false);
      if(!cue)return;
      const position=cue.platform.mesh.position, turret=cue.kind==="turret", moving=cue.kind==="moving";
      marker.root.position.set(position.x,position.y+.65,position.z-.85);
      marker.arrow.isVisible=!turret;marker.ring.isVisible=marker.barrel.isVisible=turret;
      const direction=cue.kind==="wind-left"?-1:1;
      const shape=moving?MOVE_ARROW:WIND_ARROW;
      shape.forEach((p,j)=>marker.points[j]?.set((p[0]??0)*direction,p[1]??0,0));
      MeshBuilder.CreateLines("",{points:marker.points,instance:marker.arrow});
      marker.arrow.color.set(moving?.6:.05,moving?.75:1,moving?1:.8);
      marker.root.scaling.setAll(this.#reduced||low?1:1+cue.charge*.12+Math.sin(this.model.age*6)*.025);
      if(turret) {
        marker.barrel.rotation.z=-Math.atan2(cue.aimX-position.x,cue.aimY-position.y);
        marker.barrel.position.set(-Math.sin(marker.barrel.rotation.z)*.28,Math.cos(marker.barrel.rotation.z)*.28,0);
        if(cue.charge>0) {
          marker.ray[0]?.set(position.x,position.y+.6,position.z-.9);
          marker.ray[1]?.set(cue.aimX,cue.aimY,position.z-.9);
          MeshBuilder.CreateLines("",{points:marker.ray,instance:marker.aim});
          marker.aim.alpha=.25+cue.charge*.55;marker.aim.setEnabled(true);
        }
      }
    });
    this.#shots.forEach((view,i)=>{
      const shot=this.model.projectiles[i];const active=shot?.active===true;
      view.mesh.setEnabled(active);view.tail.setEnabled(active&&!low);if(!shot||!active)return;
      view.mesh.position.set(shot.x,shot.y,-.8);
      view.points[0]?.set(shot.x-shot.vx*.045,shot.y-shot.vy*.045,-.8);
      view.points[1]?.set(shot.x,shot.y,-.8);
      MeshBuilder.CreateLines("",{points:view.points,instance:view.tail});
    });
  }
  public dispose(): void {
    for(const marker of this.#markers){marker.root.dispose();marker.aim.dispose();}
    for(const shot of this.#shots){shot.mesh.dispose();shot.tail.dispose();}
    this.#material.dispose();this.model.clear();
  }
}
