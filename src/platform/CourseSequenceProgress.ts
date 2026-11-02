import type {DepthLocation} from "../scene/DepthLocations";

/** Physical passage, not generation or destruction, completes an authored phrase. */
export class CourseSequenceProgress {
 readonly #pending=new Map<number,{location:DepthLocation;bottom:number;ended:boolean}>();
 readonly #passed=new Set<number>();
 readonly #counts=new Map<DepthLocation,number>();
 public get count():number{return this.#passed.size;}
 public countAt(location:DepthLocation):number{return this.#counts.get(location)??0;}
 public record(id:number,location:DepthLocation,bottom:number,ended:boolean):void{
  if(this.#passed.has(id))return;
  const current=this.#pending.get(id);
  this.#pending.set(id,{location,bottom:Math.min(bottom,current?.bottom??Infinity),ended:ended||current?.ended===true});
 }
 public advance(ballTop:number,onPassed:(location:DepthLocation,count:number)=>void):void{
  for(const [id,sequence] of this.#pending){
   if(!sequence.ended||ballTop>=sequence.bottom)continue;
   this.#pending.delete(id);this.#passed.add(id);
   const count=this.countAt(sequence.location)+1;this.#counts.set(sequence.location,count);onPassed(sequence.location,count);
  }
 }
 public reset():void{this.#pending.clear();this.#passed.clear();this.#counts.clear();}
}
