const clamp=(x:number):number=>Math.max(0,Math.min(1,x));
/** Earned momentum only assists successful manual hits; it never changes the
 * collision assessment, grants immunity or destroys nearby platforms. */
export class BreakFlow {
 public reserve=0;
 public streak=0;
 public powerSeconds=0;
 #sinceHit=Infinity;
 public hit(resistance:number):void{
  if(resistance>1/1.75){this.streak=0;this.reserve*=.4;this.powerSeconds*=.65;return;}
  if(this.#sinceHit>.9)this.streak=0;
  this.#sinceHit=0;this.streak++;
  this.reserve=clamp(this.reserve+(1-resistance)*.26);
  if(this.streak>=6)this.powerSeconds=3;
 }
 public update(seconds:number):void{
  if(!Number.isFinite(seconds)||seconds<=0)return;
  this.#sinceHit+=seconds;
  this.powerSeconds=Math.max(0,this.powerSeconds-seconds);
  if(this.#sinceHit>.9){this.streak=0;this.reserve=Math.max(0,this.reserve-seconds*.8);}
 }
 public reset():void{this.reserve=0;this.streak=0;this.powerSeconds=0;this.#sinceHit=Infinity;}
}

export function materialBreakTiming(speed:number,strength:number):{press:number;rupture:number;power:number}{
 const resistance=clamp(strength/Math.max(1,speed)),power=clamp((speed-25)/75);
 const press=.018+.062*resistance*resistance;
 // At high speed a small hole remains briefly after the character has passed.
 return {press,rupture:press+.025+power*.060,power};
}
