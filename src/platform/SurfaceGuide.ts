import { SURFACE_INFO, type PlatformSurface } from "./PlatformSurfaces";
import { SURFACE_ART, SURFACE_ART_URLS, SURFACE_ATLAS_SIZE } from "./SurfaceArt";
const pictures:Record<PlatformSurface,string>={
 island:'<path d="M12 22H108L89 51 35 55Z" fill="#608597"/><path d="M12 22H108L101 29H20Z" fill="#7ddc42"/><path d="m40 50-6 12m42-12 7 11" stroke="#674521"/>',
 cloud:'<path d="M20 45C1 40 8 24 25 25 26 8 49 7 57 20 70 9 85 20 85 27 108 19 119 45 99 48Z" fill="#c7edff"/>',
 bubble:'<ellipse cx="60" cy="32" rx="35" ry="27" fill="#b8efff44" stroke="#cfffff"/><path d="M39 22Q50 9 68 15" stroke="white" fill="none"/>',
 storm:'<path d="M14 43Q2 19 28 24 37 2 63 20 88 9 95 29 120 30 103 48Z" fill="#454766"/><path d="m65 24-17 17h14l-10 20 24-29H62Z" fill="#e2baff"/>',
 nest:'<path d="M17 30Q60 70 105 30Z" fill="#98713a"/><path d="m17 33 80 8M20 43l80-8" stroke="#d4a15a"/><ellipse cx="49" cy="27" rx="9" ry="13" fill="#fff5d6"/><ellipse cx="71" cy="28" rx="8" ry="12" fill="#f5e3be"/>',
 balloons:'<path d="M28 34 60 56 91 34M44 56h32" stroke="#e2ded0"/><ellipse cx="28" cy="24" rx="16" ry="21" fill="#ff6283"/><ellipse cx="60" cy="23" rx="16" ry="21" fill="#ffe24b"/><ellipse cx="92" cy="24" rx="16" ry="21" fill="#3dd0ff"/>',
 web:'<g fill="none" stroke="#bdeaff"><ellipse cx="60" cy="32" rx="48" ry="26"/><ellipse cx="60" cy="32" rx="31" ry="17"/><ellipse cx="60" cy="32" rx="15" ry="8"/><path d="M12 32h96M60 6v52M25 14l70 36M25 50l70-36"/></g>',
 crystal:'<path d="m60 4 26 23-15 32H48L33 27Z" fill="#1a6bad" stroke="#28dcff"/><path d="m60 4 4 40 22-13M33 27l31 17-16 15" fill="none" stroke="#9cf8ff"/>',
 hologram:'<path d="M17 21h88L86 51H36Z" fill="#388eee66" stroke="#6aedff" stroke-dasharray="5 4"/><path d="M18 26h87M22 34h78M29 42h65" stroke="#f093ff"/>',
 laser:'<path d="M8 32h104" stroke="#16dfff" stroke-width="5"/><path d="m60 17 15 15-15 15-15-15Z" fill="#ff4268" stroke="#ffcf65"/>',
 honeycomb:Array.from({length:6},(_,i)=>`<path d="m${String(12+i*17)} 20 10-6 10 6v13l-10 6-10-6Z" fill="#103f68" stroke="#1df2ff"/>`).join(''),
 spikes:'<path d="m12 48 14-27 12 17L54 7l12 28 18-20 23 33Z" fill="#362242" stroke="#ff365b"/>',
 magnet:'<path d="M34 18v20a26 23 0 0 0 52 0V18" fill="none" stroke="#82b3dc" stroke-width="13"/><path d="M34 11v16M86 11v16" stroke="#5cffff" stroke-width="13"/>',
 liquid:'<ellipse cx="60" cy="40" rx="48" ry="12" fill="#7450d9" stroke="#e0adff"/><path d="M35 35q12-10 26 0t26 0" fill="none" stroke="#d5adff"/>',
 resonance:'<rect x="17" y="13" width="86" height="38" rx="6" fill="#44276e" stroke="#e280ff"/><circle cx="60" cy="32" r="11" fill="none" stroke="#f2baff" stroke-width="3"/>',
};
export function surfacePreview(surface:PlatformSurface):string{
 const art=SURFACE_ART[surface];
 if(art){const [x,y,w,h]=art.rect;return `<svg class="tutorial-platform" viewBox="${String(x)} ${String(y)} ${String(w)} ${String(h)}" role="img" aria-label="${SURFACE_INFO[surface][0]}"><image href="${SURFACE_ART_URLS[art.atlas]}" width="${String(SURFACE_ATLAS_SIZE)}" height="${String(SURFACE_ATLAS_SIZE)}"/></svg>`;}
 return `<svg class="tutorial-platform" viewBox="0 0 120 65" role="img" aria-label="${SURFACE_INFO[surface][0]}">${pictures[surface]}</svg>`;
}
export function surfaceGuide(surfaces:readonly PlatformSurface[]):string{
 return `<div class="tutorial-platform-list">${surfaces.map(s=>`<article>${surfacePreview(s)}<div><h2>${SURFACE_INFO[s][0]}</h2><p>${SURFACE_INFO[s][1]}</p></div></article>`).join("")}</div>`;
}
