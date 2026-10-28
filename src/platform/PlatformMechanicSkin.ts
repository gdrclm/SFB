import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import type { Scene } from "@babylonjs/core/scene";
import type { PlatformMechanic } from "./PlatformMechanic";
import type { ApproachState } from "./PlatformReadability";

type Paint = readonly [number, number, number];
const DARK: Paint = [.045,.07,.14], METAL: Paint = [.38,.5,.63], LIGHT: Paint = [.82,.96,1];
const BLUE: Paint = [.25,.48,1], TEAL: Paint = [.05,1,.73], PINK: Paint = [1,.15,.4];
const materials = new WeakMap<Scene, StandardMaterial>();
export function prepareMechanicSkin(scene: Scene): StandardMaterial {
  const cached=materials.get(scene); if(cached)return cached;
  const material=new StandardMaterial("PlatformMachineMaterial",scene);
  material.disableLighting=true;material.emissiveColor=Color3.White();material.backFaceCulling=false;
  materials.set(scene,material);material.onDisposeObservable.addOnce(()=>materials.delete(scene));return material;
}
/** One vertex-colored silhouette and one animated part per pooled platform. */
export class PlatformMechanicSkin {
  readonly body: Mesh;
  readonly part: Mesh;
  #kind: PlatformMechanic | undefined;
  #width=0;
  #state: ApproachState | null=null;
  #aim: {x:number;y:number}|null=null;
  public reset():void {this.#aim=null;this.hide();}
  public constructor(private readonly parent: Mesh, private readonly height: number, depth: number, scene: Scene) {
    this.body=new Mesh(`${parent.name}-machine-body`,scene);
    this.part=new Mesh(`${parent.name}-machine-part`,scene);
    for(const mesh of [this.body,this.part]) {
      mesh.parent=parent;mesh.material=prepareMechanicSkin(scene);mesh.isPickable=false;mesh.position.z=-depth/2-.06;
      mesh.setEnabled(false);
    }
  }
  public render(kind: PlatformMechanic, width: number, state: ApproachState | null, elapsed: number, reduced: boolean): void {
    const rebuild=this.#kind!==kind||this.#width!==width||this.#state!==state;
    this.#kind=kind;this.#width=width;this.#state=state;
    const moving=kind==="moving", wind=kind.startsWith("wind"), tint=moving?BLUE:wind?TEAL:PINK;
    const rim:Paint=state==="danger"?PINK:state==="boost"?[1,.65,.08]:state==="breakable"?TEAL:LIGHT;
    if(rebuild) {
      const geometry=new MachineGeometry(), w=width/2, top=this.height/2;
      // The luminous contact rim stays exactly on the Havok collision surface.
      geometry.polygon([[-w,top],[-w+.16,top-.5],[w-.16,top-.5],[w,top]],DARK);
      geometry.box(-w,top-.09,width,.09,rim);
      if(moving) {
        geometry.box(-w+.14,top-.43,width-.28,.12,METAL);
        geometry.box(-w+.22,top-.29,width-.44,.1,tint);
        for(const side of [-1,1]) {
          const x=side*Math.max(.12,w-.4);
          geometry.polygon([[x-.22,top-.35],[x+.22,top-.35],[x+.17,top-.94],[x-.17,top-.94]],METAL);
          geometry.box(x-.12,top-.87,.24,.25,tint);
          geometry.polygon([[x-.12,top-.9],[x+.12,top-.9],[x,top-1.25]],tint);
        }
        geometry.box(-.3,top-.38,.6,.18,LIGHT);
      } else if(wind) {
        for(let i=0;i<7;i++) geometry.box(-w+.12+i*(width-.24)/7,top-.42,(width-.24)/12,.22,tint);
        geometry.disc(0,top-.55,.62,METAL);geometry.disc(0,top-.55,.49,DARK);
        geometry.box(-w+.1,top-.58,.15,.23,LIGHT);geometry.box(w-.25,top-.58,.15,.23,LIGHT);
      } else {
        geometry.polygon([[-w+.1,top-.12],[-w+.3,top-.72],[-.5,top-.9],[.5,top-.9],[w-.3,top-.72],[w-.1,top-.12]],METAL);
        geometry.box(-w+.22,top-.42,width-.44,.19,DARK);
        geometry.disc(0,top-.28,.44,DARK);geometry.disc(0,top-.28,.29,tint);
        for(const side of [-1,1]) geometry.box(side*(w-.28)-.09,top-.3,.18,.2,tint);
      }
      geometry.apply(this.body);
      const rotor=new MachineGeometry();
      if(wind) {
        for(let i=0;i<4;i++) {
          const a=i*Math.PI/2;
          const points=[[.08,-.06],[.44,-.11],[.33,.18],[.06,.13]].map(([x=0,y=0])=>[x*Math.cos(a)-y*Math.sin(a),x*Math.sin(a)+y*Math.cos(a)] as [number,number]);
          rotor.polygon(points,tint);
        }
        rotor.disc(0,0,.12,LIGHT);
      } else if(!moving) {
        rotor.box(-.14,0,.28,.9,DARK);rotor.box(-.09,.12,.18,.72,tint);rotor.box(-.2,.73,.4,.14,LIGHT);
      } else rotor.box(-.22,-.07,.44,.14,tint);
      rotor.apply(this.part);
      this.body.metadata={mechanic:kind,silhouette:moving?"thruster-carriage":wind?"turbine-grille":"armored-cannon"};
    }
    for(const mesh of [this.body,this.part]) {mesh.setEnabled(true);mesh.visibility=1;mesh.scaling.set(1/this.parent.scaling.x,1,1);mesh.position.y=0;}
    this.part.position.set(0,this.height/2-(wind?.55:moving?.29:.28),this.body.position.z-.03);
    this.part.rotation.z=wind?(reduced?0:elapsed*8*(kind==="wind-left"?-1:1)):this.#aim?-Math.atan2(this.#aim.x-this.parent.position.x,this.#aim.y-this.parent.position.y):0;
  }
  public aim(x: number, y: number): void {
    if(this.#kind==="turret"){this.#aim={x,y};this.part.rotation.z=-Math.atan2(x-this.parent.position.x,y-this.parent.position.y);}
  }
  public renderBreak(progress: number): void {
    for(const mesh of [this.body,this.part]) {mesh.visibility=Math.max(0,1-progress);mesh.position.y=-progress*.7;mesh.scaling.y=1-progress*.5;}
  }
  public hide(): void {this.body.setEnabled(false);this.part.setEnabled(false);}
}

class MachineGeometry {
  readonly positions:number[]=[];readonly colors:number[]=[];readonly indices:number[]=[];
  public polygon(points:readonly (readonly number[])[],paint:Paint):void {
    const offset=this.positions.length/3;
    for(const [x=0,y=0] of points){this.positions.push(x,y,0);this.colors.push(...paint,1);}
    for(let i=1;i<points.length-1;i++)this.indices.push(offset,offset+i,offset+i+1);
  }
  public box(x:number,y:number,width:number,height:number,paint:Paint):void {this.polygon([[x,y],[x+width,y],[x+width,y+height],[x,y+height]],paint);}
  public disc(x:number,y:number,radius:number,paint:Paint):void {this.polygon(Array.from({length:16},(_,i)=>[x+Math.cos(i*Math.PI/8)*radius,y+Math.sin(i*Math.PI/8)*radius]),paint);}
  public apply(mesh:Mesh):void {
    const data=new VertexData();data.positions=this.positions;data.colors=this.colors;data.indices=this.indices;
    data.normals=Array.from({length:this.positions.length},(_,i)=>i%3===2?-1:0);data.applyToMesh(mesh);
  }
}
