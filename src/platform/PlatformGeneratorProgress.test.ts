import {expect,it} from "vitest";
import {Vector3} from "@babylonjs/core/Maths/math.vector";
import {atStartDepth} from "../dev/DeveloperMode";
import {gameConfig} from "../config/gameConfig";
import type {PlatformActivationProperties,PlatformController} from "./PlatformController";
import type {PlatformPool} from "./PlatformPool";
import {PlatformGenerator} from "./PlatformGenerator";
import type {PlannedPlatform} from "./PlatformRoutePlanner";

class Slot {
 readonly mesh={position:new Vector3(0,0,0)};
 readonly size={width:7.5,height:.6,depth:1};
 isActive=false;
 activationId=0;
 properties:PlatformActivationProperties={strength:1,strengthLevel:"low"};
 motionCenterX=0;
 motionAge=0;
 get width(){return this.size.width*(this.properties.widthScale??1);}
 get strength(){return this.properties.strength;}
 get strengthLevel(){return this.properties.strengthLevel;}
 get routeKind(){return this.properties.routeKind??"mandatory";}
 get kind(){return this.properties.kind??"standard";}
 get encounterTheme(){return this.properties.encounterTheme??"chaos";}
 get appearance(){return this.properties.appearance;}
 get mechanic(){return this.properties.mechanic;}
 get lateralMotion(){return this.properties.lateralMotion;}
 get turretVolley(){return this.properties.turretVolley;}
 advanceMotion(seconds:number):void{
  this.motionAge+=Math.max(0,seconds);
  const motion=this.lateralMotion;
  if(motion)this.mesh.position.x=this.motionCenterX+motion.amplitude*Math.sin(this.motionAge*2*Math.PI/motion.period+motion.phase);
 }
}
function fixture(depth=0,speed=20){
 const config=atStartDepth(gameConfig,depth);
 const slots=Array.from({length:320},()=>new Slot());
 const pool={
  platforms:slots as unknown as PlatformController[],
  get availableCount(){return slots.filter(p=>!p.isActive).length;},
  acquire(position?:Vector3,properties?:PlatformActivationProperties):PlatformController|null{
   const slot=slots.find(p=>!p.isActive);if(!slot||!position||!properties)return null;
   slot.mesh.position.copyFrom(position);slot.motionCenterX=position.x;slot.motionAge=0;
   slot.properties=properties;slot.activationId++;slot.isActive=true;
   slot.advanceMotion(0);
   return slot as unknown as PlatformController;
  },
  release(platform:PlatformController):boolean{const slot=platform as unknown as Slot;if(!slot.isActive)return false;slot.isActive=false;return true;},
 } as unknown as PlatformPool;
 const ball={fallSpeed:speed,position:{x:0,y:config.ball.startPosition.y,z:0}};
 const generator=new PlatformGenerator(ball,pool,{currentDifficulty:{stageNumber:7,platformStrength:speed,reactionWindowSeconds:.8}},config,()=>.3);
 const plans:PlannedPlatform[]=[];
 generator.onPlatformGenerated((plan,additional)=>{if(!additional)plans.push(plan);});
 return {config,slots,pool,ball,generator,plans};
}
function rowFloor(plan:PlannedPlatform):number{
 return Math.min(plan.y,...(plan.choices??[]).map(choice=>plan.y+(choice.yOffset??0)));
}
function firstSequence(f:ReturnType<typeof fixture>):PlannedPlatform[]{
 f.generator.fixedUpdate();
 for(let i=0;i<12&&!f.plans.some(p=>p.sequenceEnd);i++){
  const row=f.plans[i];if(!row)throw Error("Missing generated row");
  f.ball.position.y=rowFloor(row)-f.config.ball.radius-.31;
  f.generator.fixedUpdate();
 }
 const end=f.plans.find(p=>p.sequenceEnd);if(!end)throw Error("Missing sequence boundary");
 return f.plans.filter(p=>p.sequenceId===end.sequenceId);
}

it("counts a sequence only after the ball's top clears every staggered member, independently of broken and reused pool slots",()=>{
 const f=fixture(),sequence=firstSequence(f);
 expect(f.generator.completedSequenceCount).toBe(0);
 const floor=Math.min(...sequence.map(rowFloor))-.3;
 f.ball.position.y=floor-f.config.ball.radius+.01;f.generator.fixedUpdate();
 expect(f.generator.completedSequenceCount).toBe(0);
 // All original colliders may already have broken and their slots may be reused.
 for(const slot of f.slots)if(sequence.some(plan=>slot.mesh.position.y>=rowFloor(plan)-.001&&slot.mesh.position.y<=plan.y+.001)){
  slot.isActive=false;slot.activationId++;slot.mesh.position.set(100,-10000,0);
 }
 f.generator.fixedUpdate();expect(f.generator.completedSequenceCount).toBe(0);
 f.ball.position.y=floor-f.config.ball.radius-.01;f.generator.fixedUpdate();
 expect(f.generator.completedSequenceCount).toBe(1);
 f.ball.position.y+=4;f.generator.fixedUpdate();f.ball.position.y-=4;f.generator.fixedUpdate();
 expect(f.generator.completedSequenceCount).toBe(1);
 f.generator.resumeFromCurrentPosition();expect(f.generator.completedSequenceCount).toBe(0);
 f.generator.fixedUpdate();expect(f.generator.completedSequenceCount).toBe(0);
});

it("does not count side copies as extra sequences or wait for their decorative vertical shift",()=>{
 const f=fixture();f.generator.setPlayfieldHalfWidth(18);
 const sequence=firstSequence(f),floor=Math.min(...sequence.map(rowFloor))-.3;
 expect(f.slots.some(p=>p.isActive&&Math.abs(p.mesh.position.x)>5)).toBe(true);
 f.ball.position.y=floor-f.config.ball.radius-.01;f.generator.fixedUpdate();
 expect(f.generator.completedSequenceCount).toBe(1);
 f.ball.position.y-=1;f.generator.fixedUpdate();
 expect(f.generator.completedSequenceCount).toBe(1);
});

it("mirrors mover centers and phase when the playfield widens after motion has started",()=>{
 const f=fixture(500,45);f.generator.fixedUpdate(.37);
 const source=f.slots.find(p=>p.isActive&&p.mechanic==="moving"&&p.lateralMotion);
 if(!source)throw Error("Missing introductory shuttle");
 f.generator.fixedUpdate(.37);
 const originalCenter=source.motionCenterX,motion=source.lateralMotion;
 if(!motion)throw Error("Missing shuttle motion");
 f.generator.setPlayfieldHalfWidth(18);f.generator.fixedUpdate(0);
 const mirror=f.slots.find(p=>p.isActive&&p.mechanic==="moving"&&Math.abs(p.motionCenterX-(-originalCenter-10))<.0001
  &&Math.abs(p.mesh.position.y-source.mesh.position.y)<2);
 if(!mirror?.lateralMotion)throw Error("Missing mirrored shuttle");
 expect(mirror.motionCenterX).toBeCloseTo(-originalCenter-10);
 const phaseDelta=mirror.lateralMotion.phase-motion.phase-source.motionAge*2*Math.PI/motion.period;
 expect(Math.cos(phaseDelta)).toBeCloseTo(-1);
 expect(mirror.mesh.position.x).toBeCloseTo(-source.mesh.position.x-10);
 f.generator.fixedUpdate(.1);
 expect(mirror.mesh.position.x).toBeCloseTo(-source.mesh.position.x-10);
});

it("gives each mirrored turret formation its own volley identity while preserving member order",()=>{
 const f=fixture(1400,80);f.generator.setPlayfieldHalfWidth(18);
 f.generator.fixedUpdate();
 for(let i=0;i<300&&!f.slots.some(p=>p.isActive&&p.turretVolley);i++){
  f.ball.position.y-=8;f.generator.fixedUpdate();
 }
 const source=f.slots.find(p=>p.isActive&&p.turretVolley&&Math.abs(p.mesh.position.x)<5);
 if(!source?.turretVolley)throw Error("Missing authored turret volley");
 const group=source.turretVolley;
 const mirrored=f.slots.filter(p=>p.isActive&&p.turretVolley&&Math.abs(p.mesh.position.x)>5
  &&Math.abs(p.mesh.position.y-source.mesh.position.y)<f.ball.fallSpeed/3);
 expect(mirrored.length).toBeGreaterThan(0);
 expect(mirrored.every(p=>p.turretVolley?.id!==group.id)).toBe(true);
 expect(mirrored.some(p=>p.turretVolley?.index===group.index)).toBe(true);
});
