const clamp=(x:number):number=>Math.max(0,Math.min(1,x));
export const FLOW_ENTRY_SPEED = 70;
export const FLOW_HITS_REQUIRED = 6;
export const FLOW_HIT_WINDOW = 1.4;
export const FLOW_SECONDS = 8;
export const FLOW_MAX_SECONDS = 12;
/** Earned momentum only assists successful manual hits; it never changes the
 * collision assessment, grants immunity or destroys nearby platforms. */
export class BreakFlow {
 public reserve=0;
 public streak=0;
 public powerSeconds=0;
 #sinceHit=Infinity;
 #powerAge=0;
 public hit(resistance:number,speed:number):void{
  if(!Number.isFinite(resistance)||resistance<0||!Number.isFinite(speed)||speed<0)return;
  if(resistance>1/1.75){this.streak=0;this.reserve*=.4;this.powerSeconds*=.65;return;}
  if(this.#sinceHit>FLOW_HIT_WINDOW)this.streak=0;
  this.#sinceHit=0;
  this.reserve=clamp(this.reserve+(1-resistance)*.26);
  if(this.powerSeconds>0){
   this.powerSeconds=Math.min(this.powerSeconds+.6,FLOW_MAX_SECONDS-this.#powerAge);
   return;
  }
  if(speed<FLOW_ENTRY_SPEED){this.streak=0;return;}
  this.streak++;
  if(this.streak>=FLOW_HITS_REQUIRED){this.powerSeconds=FLOW_SECONDS;this.#powerAge=0;}
 }
 public update(seconds:number):void{
  if(!Number.isFinite(seconds)||seconds<=0)return;
  this.#sinceHit+=seconds;
  if(this.powerSeconds>0){
   this.#powerAge+=seconds;
   this.powerSeconds=Math.max(0,Math.min(this.powerSeconds-seconds,FLOW_MAX_SECONDS-this.#powerAge));
   if(this.powerSeconds<=1e-9){this.powerSeconds=0;this.#powerAge=0;this.streak=0;}
  }
  if(this.#sinceHit>FLOW_HIT_WINDOW){this.streak=0;this.reserve=Math.max(0,this.reserve-seconds*(this.powerSeconds>0?.08:.8));}
 }
 public reset():void{this.reserve=0;this.streak=0;this.powerSeconds=0;this.#powerAge=0;this.#sinceHit=Infinity;}
}

export function materialBreakTiming(speed:number,strength:number):{press:number;rupture:number;power:number}{
 const resistance=clamp(strength/Math.max(1,speed)),power=clamp((speed-25)/75);
 const press=.018+.062*resistance*resistance;
 // At high speed a small hole remains briefly after the character has passed.
 return {press,rupture:press+.025+power*.060,power};
}
