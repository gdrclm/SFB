import skyUrl from "../assets/platforms/surfaces-sky.webp";
import specialUrl from "../assets/platforms/surfaces-special.webp";
import crystalUrl from "../assets/platforms/surfaces-crystal.webp";
import breakUrl from "../assets/platforms/surfaces-break.webp";
import type { PlatformSurface } from "./PlatformSurfaces";

export const SURFACE_ATLAS_SIZE = 1254;
export const SURFACE_ART_URLS = [skyUrl, specialUrl, crystalUrl, breakUrl] as const;
export interface SurfaceArt {
  readonly atlas: 0 | 1 | 2;
  readonly rect: readonly [number, number, number, number];
  /** Source-image height of the collision plane, independently of foliage/FX. */
  readonly rim: number;
  readonly height: number;
  readonly burst: 0 | 1 | 2 | 3 | -1;
}
/** Coordinates address the original generated sheets; no runtime image extraction. */
export const SURFACE_ART: Partial<Record<PlatformSurface, SurfaceArt>> = {
  island: {atlas:0,rect:[0,45,627,520],rim:210,height:1.95,burst:0},
  storm: {atlas:0,rect:[627,80,627,460],rim:205,height:1.65,burst:1},
  nest: {atlas:0,rect:[0,690,627,510],rim:850,height:1.65,burst:2},
  balloons: {atlas:0,rect:[627,627,627,627],rim:760,height:3.6,burst:-1},
  web: {atlas:1,rect:[0,125,627,355],rim:300,height:1.05,burst:-1},
  hologram: {atlas:1,rect:[627,110,627,430],rim:260,height:1.65,burst:-1},
  laser: {atlas:1,rect:[12,730,600,235],rim:862,height:.95,burst:3},
  honeycomb: {atlas:1,rect:[660,700,575,490],rim:765,height:.7,burst:3},
  spikes: {atlas:2,rect:[0,40,627,530],rim:120,height:1.95,burst:3},
  magnet: {atlas:2,rect:[627,170,627,400],rim:235,height:1.75,burst:3},
  liquid: {atlas:2,rect:[0,730,627,490],rim:850,height:1.65,burst:-1},
  resonance: {atlas:2,rect:[627,730,627,500],rim:825,height:1.75,burst:3},
};
export function surfaceArtLayout(art:SurfaceArt,width:number):readonly [number,number,number,number]{
  const height=art.height*Math.min(1,Math.max(.5,width/2.3));
  return [width+.12,height,.15+((art.rim-art.rect[1])/art.rect[3]-.5)*height,art.atlas];
}
export function surfaceUVRect(rect:SurfaceArt["rect"]):readonly [number,number,number,number]{
  return [rect[0]/SURFACE_ATLAS_SIZE,1-(rect[1]+rect[3])/SURFACE_ATLAS_SIZE,rect[2]/SURFACE_ATLAS_SIZE,rect[3]/SURFACE_ATLAS_SIZE];
}
/** Four painted keyframes, blended continuously instead of snapping frames. */
export function surfaceBreakFrames(progress:number):readonly [number,number,number]{
  const frame=Math.max(0,Math.min(3,progress*3));
  return [Math.floor(frame),Math.min(3,Math.floor(frame)+1),frame-Math.floor(frame)];
}
