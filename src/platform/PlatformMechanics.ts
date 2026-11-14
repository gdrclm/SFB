import type { PlatformController } from "./PlatformController";
import type { PlatformMechanic, TurretVolley } from "./PlatformMechanic";

export interface MechanicPoint { x: number; y: number; z: number }
export interface MechanicBall {
  readonly position: MechanicPoint;
  readonly previousPosition: MechanicPoint;
  readonly fallSpeed: number;
  readonly verticalVelocity?: number;
}
export type MechanicPlatform = Pick<PlatformController, "isActive" | "activationId" | "mechanic" | "width"> & {
  readonly mesh: { readonly position: MechanicPoint };
  readonly motionCenterX?: number;
  readonly lateralMotion?: {readonly amplitude: number} | undefined;
  readonly turretVolley?:TurretVolley|undefined;
  readonly encounterOverlay?:PlatformController["encounterOverlay"];
  setMechanicAim?(x: number, y: number): void;
};
export interface MechanicViewport { left: number; right: number; bottom: number; top: number }
export interface MechanicCue { platform: MechanicPlatform; kind: PlatformMechanic; charge: number; aimX: number; aimY: number }
export interface PlatformProjectile {
  active: boolean; x: number; y: number; vx: number; vy: number; age: number;
  source: MechanicPlatform | null; activation: number;
}
interface TrapState { activation: number; windAge: number; triggered: boolean }
interface Charge { platform: MechanicPlatform; activation: number; age: number; duration: number; aimX: number; aimY: number }
interface VolleyMember { platform:MechanicPlatform; activation:number; due:number; visibleAge:number; aimX:number; aimY:number; done:boolean }
interface VolleyCharge { age:number; lastShotAt:number; members:VolleyMember[] }
export const TURRET_VOLLEY_WARNING=.50, TURRET_VOLLEY_INTERVAL=.32;

/** Continuous relative sweep, including a fast ball crossing a small projectile. */
export function projectileHitsBall(px: number, py: number, x: number, y: number, previous: MechanicPoint, current: MechanicPoint, radius: number): boolean {
  const ax=px-previous.x, ay=py-previous.y, bx=x-current.x, by=y-current.y;
  const dx=bx-ax, dy=by-ay, length=dx*dx+dy*dy;
  const t=length>1e-10 ? Math.max(0,Math.min(1,-(ax*dx+ay*dy)/length)) : 0;
  return (ax+dx*t)**2+(ay+dy*t)**2<=radius*radius;
}

export class PlatformMechanics {
  readonly projectiles: PlatformProjectile[] = Array.from({length:4},()=>({active:false,x:0,y:0,vx:0,vy:0,age:0,source:null,activation:0}));
  readonly cues: MechanicCue[] = [];
  readonly #states = new WeakMap<MechanicPlatform, TrapState>();
  #charging: Charge | null = null;
  #volley:VolleyCharge|null=null;
  #cooldown = 0;
  #age = 0;
  public get age(): number { return this.#age; }
  public constructor(
    private readonly ball: MechanicBall,
    private readonly platforms: () => readonly MechanicPlatform[],
    private readonly viewport: () => MechanicViewport,
    private readonly movementScale: number,
    private readonly radius: number,
    private readonly onWind: (direction: number) => void,
    private readonly onProjectile: (platform: MechanicPlatform) => void,
    private readonly enabled: () => boolean = () => true,
  ) {}

  public fixedUpdate(seconds: number): void {
    this.cues.length=0;
    if (!this.enabled()) { this.clear(); return; }
    const dt=Math.max(0,Math.min(.1,seconds));
    this.#age+=dt; this.#cooldown=Math.max(0,this.#cooldown-dt);
    const view=this.viewport(), ball=this.ball.position;
    const worldSpeed=Math.max(1,this.ball.verticalVelocity===undefined?this.ball.fallSpeed*this.movementScale:Math.abs(this.ball.verticalVelocity));
    const visible=(p:MechanicPlatform):boolean => p.isActive && p.mesh.position.y>=view.bottom && p.mesh.position.y<=view.top
      && p.mesh.position.x+p.width/2>=view.left && p.mesh.position.x-p.width/2<=view.right;
    const readyGroups=new Map<string,boolean>();
    const groupReady=(p:MechanicPlatform):boolean=>{
      const group=p.turretVolley;if(!group)return true;
      const cached=readyGroups.get(group.id);if(cached!==undefined)return cached;
      let ready=group.count>=1;
      for(let index=0;index<Math.min(3,group.count);index++)ready&&=this.platforms().some(member=>member.isActive&&member.mechanic==="turret"&&member.turretVolley?.id===group.id&&member.turretVolley.index===index);
      readyGroups.set(group.id,ready);return ready;
    };
    let candidate: MechanicPlatform | null=null, candidateDistance=Infinity;
    const sorted=this.platforms().filter(p=>p.mechanic && visible(p)).sort((a,b)=>
      Math.abs(a.mesh.position.y-ball.y)+Math.abs(a.mesh.position.x-ball.x)-Math.abs(b.mesh.position.y-ball.y)-Math.abs(b.mesh.position.x-ball.x));
    // Keep every active warning inside the bounded eight-marker view, even
    // when wide-screen mirrored cells contain many closer inactive machines.
    const pinned=this.#volley?.members.filter(m=>!m.done&&m.activation===m.platform.activationId&&visible(m.platform)).map(m=>m.platform)
      ?? (this.#charging&&visible(this.#charging.platform)?[this.#charging.platform]:[]);
    const nearby=[...new Set([...pinned,...sorted])].slice(0,8);
    for (const platform of nearby) {
      const kind=platform.mechanic;
      if (!kind || !visible(platform)) continue;
      let state=this.#states.get(platform);
      if (!state || state.activation!==platform.activationId) {
        state={activation:platform.activationId,windAge:0,triggered:false};this.#states.set(platform,state);
      }
      const gap=ball.y-platform.mesh.position.y;
      let charge=0;
      const direction=kind==="wind-left"?-1:1;
      const windDistance=(ball.x-platform.mesh.position.x)*direction;
      if (kind.startsWith("wind") && gap>0 && gap/worldSpeed<1.8 && windDistance> -platform.width/2-this.radius
        && windDistance<platform.width/2+this.radius+2.2) {
        state.windAge+=dt;charge=Math.min(1,state.windAge/.45);
        if (!state.triggered && state.windAge>=.45 && gap<Math.max(2.2,worldSpeed*.6)) {
          state.triggered=true;this.onWind(kind==="wind-left"?-1:1);
        }
      }
      if (kind==="turret" && !state.triggered && (!platform.turretVolley||platform.turretVolley.index===0)
        && groupReady(platform)&&gap/worldSpeed>=.65 && gap/worldSpeed<=3 && Math.abs(ball.x-platform.mesh.position.x)<10) {
        const distance=gap+Math.abs(ball.x-platform.mesh.position.x)*2;
        if (distance<candidateDistance) {candidate=platform;candidateDistance=distance;}
      }
      if (this.cues.length<16) this.cues.push({platform,kind,charge,aimX:ball.x,aimY:ball.y});
    }
    if (this.#charging && (!visible(this.#charging.platform) || this.#charging.platform.activationId!==this.#charging.activation
      || this.#charging.platform.mesh.position.y>ball.y || !this.cues.some(c=>c.platform===this.#charging?.platform))) this.#charging=null;
    if (!this.#charging && !this.#volley && candidate && this.#cooldown===0) {
      if(candidate.turretVolley){
        const group=candidate.turretVolley,members:VolleyMember[]=[];
        for(let index=0;index<Math.min(3,group.count);index++){
          const platform=this.platforms().find(p=>p.isActive&&p.mechanic==="turret"&&p.turretVolley?.id===group.id&&p.turretVolley.index===index);
          if(!platform)continue;
          const due=TURRET_VOLLEY_WARNING+index*TURRET_VOLLEY_INTERVAL;
          members.push({platform,activation:platform.activationId,due,visibleAge:0,aimX:ball.x,aimY:ball.y-worldSpeed*due,done:false});
        }
        if(members.length===Math.min(3,group.count))this.#volley={age:0,lastShotAt:-Infinity,members};
      }else{
        const duration=Math.max(.45,Math.min(.85,(ball.y-candidate.mesh.position.y)/worldSpeed*.55));
        this.#charging={platform:candidate,activation:candidate.activationId,age:0,duration,aimX:ball.x,aimY:ball.y-worldSpeed*duration};
      }
    }
    const charging=this.#charging;
    if (charging) {
      charging.age+=dt;
      const cue=this.cues.find(c=>c.platform===charging.platform);
      if (cue) {cue.charge=Math.min(1,charging.age/charging.duration);cue.aimX=charging.aimX;cue.aimY=charging.aimY;}
      charging.platform.setMechanicAim?.(charging.aimX,charging.aimY);
      if(cue && this.cues[0]!==cue){this.cues.splice(this.cues.indexOf(cue),1);this.cues.unshift(cue);}
      if (charging.age>=charging.duration) {
        this.#fire(charging.platform,charging.activation,charging.aimX,charging.aimY);
        this.#cooldown=2.2;
        this.#charging=null;
      }
    }
    const volley=this.#volley;
    if(volley){
      volley.age+=dt;
      for(const member of volley.members){
        if(member.done)continue;
        const platform=member.platform;
        if(!platform.isActive||platform.activationId!==member.activation||platform.mesh.position.y>=ball.y){member.done=true;continue;}
        if(!visible(platform))continue;
        let cue=this.cues.find(c=>c.platform===platform);
        if(!cue&&this.cues.length<8){cue={platform,kind:"turret",charge:0,aimX:member.aimX,aimY:member.aimY};this.cues.unshift(cue);}
        if(cue){member.visibleAge+=dt;cue.charge=Math.min(1,volley.age/member.due);cue.aimX=member.aimX;cue.aimY=member.aimY;}
        platform.setMechanicAim?.(member.aimX,member.aimY);
        // A lower step may enter the camera later. Its own warning must still
        // be visible for .45s; skip a passed step instead of firing a late ambush.
      }
      const next=volley.members.find(member=>!member.done);
      if(next&&volley.age>=next.due&&next.visibleAge>=.45&&volley.age-volley.lastShotAt>=TURRET_VOLLEY_INTERVAL-1e-9
        &&visible(next.platform)&&this.cues.some(c=>c.platform===next.platform)){
        this.#fire(next.platform,next.activation,next.aimX,next.aimY);next.done=true;volley.lastShotAt=volley.age;
      }
      if(volley.members.every(member=>member.done)){this.#volley=null;this.#cooldown=2.2;}
    }
    for (const shot of this.projectiles) {
      if (!shot.active) continue;
      if (!shot.source?.isActive || shot.source.activationId!==shot.activation) {shot.active=false;continue;}
      const previousX=shot.x, previousY=shot.y, justSpawned=shot.age===0;
      shot.x+=shot.vx*dt;shot.y+=shot.vy*dt;shot.age+=dt;
      if (projectileHitsBall(previousX,previousY,shot.x,shot.y,justSpawned?ball:this.ball.previousPosition,ball,this.radius+.18)) {
        shot.active=false;this.onProjectile(shot.source);
      }
      if (shot.age>2 || shot.y>view.top+2 || shot.y<view.bottom-2 || shot.x<view.left-2 || shot.x>view.right+2) shot.active=false;
    }
  }
  #fire(platform:MechanicPlatform,activation:number,aimX:number,aimY:number):void{
    const state=this.#states.get(platform);if(state)state.triggered=true;
    const shot=this.projectiles.find(p=>!p.active);if(!shot)return;
    const source=platform.mesh.position,x=source.x,y=source.y+.55,dx=aimX-x,dy=aimY-y;
    const length=Math.max(.01,Math.hypot(dx,dy));
    Object.assign(shot,{active:true,x,y,vx:dx/length*14,vy:dy/length*14,age:0,source:platform,activation});
  }
  public clear(): void {
    this.#charging=null;this.#volley=null;this.#cooldown=0;this.cues.length=0;
    for(const shot of this.projectiles)shot.active=false;
  }
}
