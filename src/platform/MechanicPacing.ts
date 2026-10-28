import type { MechanicPlatform, MechanicViewport } from "./PlatformMechanics";
import type { PlatformMechanic } from "./PlatformMechanic";
interface PacingBall { readonly position: {x:number;y:number}; readonly fallSpeed:number; readonly isBouncing?:boolean; setEncounterTravelScale(scale:number):void }
/** Give the first encounter with each machine time to read, without spending or
 * resetting earned speed. This changes descent only; steering and trap clocks run normally. */
export class MechanicPacing {
  readonly #seen=new Set<string>();
  #active:{platform:MechanicPlatform;activation:number;age:number}|null=null;
  #scale=1;
  public get scale():number{return this.#scale;}
  public constructor(private readonly ball:PacingBall,private readonly platforms:()=>readonly MechanicPlatform[],
    private readonly viewport:()=>MechanicViewport,private readonly movementScale:number,private readonly enabled:()=>boolean=()=>true,
    private readonly onEncounter:(kind:PlatformMechanic)=>void=()=>{}){}
  public fixedUpdate(seconds:number,realSeconds=seconds):void {
    if(!this.enabled()||this.ball.isBouncing){this.#active=null;this.#scale=1;this.ball.setEncounterTravelScale(1);return;}
    const dt=Math.max(0,Math.min(.1,realSeconds)),view=this.viewport(),below=Math.max(5,this.ball.position.y-view.bottom);
    const active=this.#active;
    if(active) {
      active.age+=dt;
      if(!active.platform.isActive||active.platform.activationId!==active.activation||active.platform.mesh.position.y>=this.ball.position.y+.5||active.age>6)this.#active=null;
    }
    if(!this.#active) {
      const candidate=this.platforms().filter(p=>{
        const key=p.mechanic?.startsWith("wind")?"wind":p.mechanic;
        const gap=this.ball.position.y-p.mesh.position.y;
        return p.isActive&&key&&!this.#seen.has(key)&&gap>0&&gap<below*1.5
          &&Math.abs(p.mesh.position.x-this.ball.position.x)<p.width/2+4;
      }).sort((a,b)=>Math.abs(a.mesh.position.y-this.ball.position.y)-Math.abs(b.mesh.position.y-this.ball.position.y))[0];
      if(candidate?.mechanic){this.#seen.add(candidate.mechanic.startsWith("wind")?"wind":candidate.mechanic);this.#active={platform:candidate,activation:candidate.activationId,age:0};this.onEncounter(candidate.mechanic);}
    }
    const simulationScale=realSeconds>0?seconds/realSeconds:1;
    const desired=this.#active?Math.min(1,Math.max(3.5,below/2.5)/Math.max(.001,this.ball.fallSpeed*this.movementScale*simulationScale)):1;
    this.#scale+=(desired-this.#scale)*(1-Math.exp(-(desired<this.#scale?12:5)*dt));
    this.ball.setEncounterTravelScale(this.#scale);
  }
}
