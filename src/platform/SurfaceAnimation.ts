import idleSky from "../assets/platforms/surface-idle-sky.webp";
import idleSpecial from "../assets/platforms/surface-idle-special.webp";
import idleAdvanced from "../assets/platforms/surface-idle-advanced.webp";
import destroySky from "../assets/platforms/surface-destroy-sky.webp";
import destroySpecial from "../assets/platforms/surface-destroy-special.webp";
import destroyAdvanced from "../assets/platforms/surface-destroy-advanced.webp";
import { SURFACE_ANIMATION_LAYOUT } from "./SurfaceAnimationLayout";
import type { PlatformSurface } from "./PlatformSurfaces";
import type { PlatformMechanic } from "./PlatformMechanic";

export type SurfaceSprite = PlatformSurface | PlatformMechanic;
export type AnimationRect = readonly [number,number,number,number];
export const SURFACE_ANIMATION_URLS=[idleSky,idleSpecial,idleAdvanced,destroySky,destroySpecial,destroyAdvanced] as const;
export const SURFACE_FRAME_COUNT=6;
interface Sheet {readonly size:readonly number[];readonly cell:readonly number[];readonly bounds:readonly (readonly number[])[];readonly body:readonly (readonly number[])[]}
export interface SurfaceAnimation {
 readonly bank:number;readonly row:number;readonly idle:readonly AnimationRect[];readonly destroy:readonly AnimationRect[];
 readonly body:readonly number[];readonly destroyBounds:readonly number[];readonly height:number;readonly rim:number;
}
const parameters:Record<string,readonly [number,number]>={
 island:[1.95,.33],storm:[1.65,.22],nest:[1.65,.33],balloons:[3.6,.10],web:[1.05,.5],hologram:[1.65,.30],laser:[.95,.55],honeycomb:[.7,.12],spikes:[1.95,.18],
 magnet:[1.75,.20],liquid:[1.65,.25],resonance:[1.75,.25],moving:[1.6,.18],wind:[1.65,.16],turret:[2.05,.53],
};
function rects(sheet:Sheet,row:number):readonly AnimationRect[]{
 const [aw=1,ah=1]=sheet.size,[cw=1,ch=1]=sheet.cell,[x=0,y=0,w=1,h=1]=sheet.bounds[row]??[];
 return Array.from({length:SURFACE_FRAME_COUNT},(_,frame)=>[(frame*cw+x)/aw,1-(row*ch+y+h)/ah,w/aw,h/ah] as const);
}
const animations=new Map<string,SurfaceAnimation>();
for(const [bank,group]of SURFACE_ANIMATION_LAYOUT.entries())for(const [row,kind]of group.kinds.entries()){
 const [height=1.65,rim=.25]=parameters[kind]??[];
 animations.set(kind,{bank,row,idle:rects(group.idle,row),destroy:rects(group.destroy,row),body:group.destroy.body[row]??[0,0,1,1],destroyBounds:group.destroy.bounds[row]??[0,0,1,1],height,rim});
}
const crystalArt=animations.get("hologram");
if(crystalArt)animations.set("crystal",{...crystalArt,height:2.2});
export function surfaceAnimation(kind:SurfaceSprite):SurfaceAnimation|undefined{return animations.get(kind.startsWith("wind")?"wind":kind);}
export function surfaceAnimationLayout(art:SurfaceAnimation,width:number):AnimationRect{
 const height=art.height*Math.min(1,Math.max(.5,width/2.3));return [width+.12,height,.15+(art.rim-.5)*height,art.bank];
}
export function surfaceDestroyLayout(art:SurfaceAnimation,layout:AnimationRect):AnimationRect{
 const [x=0,y=0,w=1,h=1]=art.body,[,,bw=1,bh=1]=art.destroyBounds;
 const width=layout[0]*bw/w,height=layout[1]*bh/h;
 return [width,height,-((x+w*.5)/bw-.5)*width,layout[2]+((y+h*.5)/bh-.5)*height];
}
/** Six actual painted poses, continuously interpolated with a seamless wrap. */
export function surfaceIdleFrames(time:number,seed=0,reduced=false):readonly [number,number,number]{
 if(reduced)return [0,0,0];const phase=((time/2.4*SURFACE_FRAME_COUNT+seed*.37)%SURFACE_FRAME_COUNT+SURFACE_FRAME_COUNT)%SURFACE_FRAME_COUNT;
 return [Math.floor(phase),(Math.floor(phase)+1)%SURFACE_FRAME_COUNT,phase-Math.floor(phase)];
}
export function surfaceBreakFrames(progress:number,reduced=false):readonly [number,number,number]{
 if(reduced)return [2,2,0];const frame=Math.max(0,Math.min(SURFACE_FRAME_COUNT-1,progress*SURFACE_FRAME_COUNT));
 return [Math.floor(frame),Math.min(SURFACE_FRAME_COUNT-1,Math.floor(frame)+1),frame-Math.floor(frame)];
}
