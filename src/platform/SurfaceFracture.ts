export const SURFACE_FRAGMENT_COUNT=8;
export const SURFACE_FRAGMENT_VERTICES=16;
export type FractureMaterial="solid"|"vapor"|"silk"|"liquid";
export interface FractureBounds{left:number;right:number;bottom:number;top:number}
interface Point{x:number;y:number}
export interface FracturePiece{readonly polygon:readonly Point[];readonly center:Point;readonly seed:number;readonly radius:number;readonly vx:number;readonly vy:number;readonly spin:number;readonly delay:number}
function hash(n:number):number{return (Math.sin(n*37.3+17.1)*43758.54)%1*.5+.5;}
/** Clip to one Voronoi half-plane. The pieces tile the original artwork exactly. */
function clip(polygon:readonly Point[],a:Point,b:Point):Point[]{
 const nx=b.x-a.x,ny=b.y-a.y,limit=(b.x*b.x+b.y*b.y-a.x*a.x-a.y*a.y)/2,out:Point[]=[];
 for(let i=0;i<polygon.length;i++){
  const p=polygon[i],q=polygon[(i+1)%polygon.length];if(!p||!q)continue;
  const dp=p.x*nx+p.y*ny-limit,dq=q.x*nx+q.y*ny-limit;
  if(dp<=1e-8)out.push(p);
  if((dp<0)!==(dq<0)){const t=dp/(dp-dq);out.push({x:p.x+(q.x-p.x)*t,y:p.y+(q.y-p.y)*t});}
 }
 return out;
}
export class SurfaceFracture{
 readonly positions=new Float32Array(SURFACE_FRAGMENT_COUNT*SURFACE_FRAGMENT_VERTICES*3);
 readonly uvs=new Float32Array(SURFACE_FRAGMENT_COUNT*SURFACE_FRAGMENT_VERTICES*2);
 readonly shardData=new Float32Array(SURFACE_FRAGMENT_COUNT*SURFACE_FRAGMENT_VERTICES*4);
 readonly indices=Array.from({length:SURFACE_FRAGMENT_COUNT},(_,piece)=>Array.from({length:SURFACE_FRAGMENT_VERTICES-2},(_,i)=>[piece*SURFACE_FRAGMENT_VERTICES,piece*SURFACE_FRAGMENT_VERTICES+i+1,piece*SURFACE_FRAGMENT_VERTICES+i+2]).flat()).flat();
 readonly #rest=new Float32Array(this.positions.length);
 #pieces:FracturePiece[]=[];#gravity=16;#reduced=false;#material:FractureMaterial="solid";
 public get pieces():readonly FracturePiece[]{return this.#pieces;}
 public prepare(bounds:FractureBounds,width:number,contactX:number,speed:number,seed:number,material:FractureMaterial,reduced=false):void{
  const w=bounds.right-bounds.left,h=bounds.top-bounds.bottom,cx=(bounds.left+bounds.right)/2,cy=(bounds.bottom+bounds.top)/2;
  const pattern=[[-.36,.29],[0,.33],[.35,.29],[-.25,-.05],[.20,-.07],[-.36,-.36],[0,-.37],[.36,-.35]];
  const sites=pattern.map(([x=0,y=0],i)=>({x:cx+x*w+(hash(seed+i*3)-.5)*w*.07+(i===1?Math.max(-w*.2,Math.min(w*.2,contactX-cx)):0),y:cy+y*h+(hash(seed+i*7)-.5)*h*.06}));
  const power=Math.max(0,Math.min(1,Math.log2(Math.max(1,speed/18))/3.5)),fall=Math.max(2,speed/3);
  this.#material=material;this.#reduced=reduced;this.#gravity=material==="vapor"?2:material==="silk"?3:material==="liquid"?12:16;
  this.#pieces=sites.map((site,index)=>{
   let polygon:Point[]=[{x:bounds.left,y:bounds.bottom},{x:bounds.right,y:bounds.bottom},{x:bounds.right,y:bounds.top},{x:bounds.left,y:bounds.top}];
   for(const [j,other]of sites.entries())if(j!==index)polygon=clip(polygon,site,other);
   const center={x:polygon.reduce((sum,p)=>sum+p.x,0)/polygon.length,y:polygon.reduce((sum,p)=>sum+p.y,0)/polygon.length};
   const n=hash(seed+index*11),side=Math.sign(center.x-contactX)||(index%2?1:-1),radial=Math.max(-1,Math.min(1,(center.x-contactX)/Math.max(.3,w/2)));
   const softness=material==="vapor"?.6:material==="silk"?.7:1;
   return {polygon,center,seed:n,radius:Math.max(...polygon.map(p=>Math.hypot(p.x-center.x,p.y-center.y))),
    vx:(side*(2.8+n*2.8)+radial*1.6)*(1+power*.2)*softness*(reduced?.12:1),
    vy:-fall*(.65+n*.25)-(1-Math.abs(radial))*2.8+(n-.5)*2,
    spin:side*(1.8+n*4.5)*(material==="vapor"?.15:material==="liquid"?.25:1)*(reduced?0:1),delay:.025+Math.abs(center.x-contactX)*.008};
  });
  for(const [i,piece]of this.#pieces.entries())for(let v=0;v<SURFACE_FRAGMENT_VERTICES;v++){
   const p=v===0?piece.center:piece.polygon[Math.min(v-1,piece.polygon.length)]??piece.polygon[0]??piece.center,n=i*SURFACE_FRAGMENT_VERTICES+v;
   this.#rest.set([p.x,p.y,0],n*3);this.uvs.set([p.x/(width+2.6)+.5,(p.y+.7)/5+.5],n*2);
   this.shardData.set([piece.center.x,piece.center.y,piece.radius,v===0?0:1],n*4);
  }
  this.positions.set(this.#rest);
 }
 /** Analytic trajectories keep separation, gravity and angular motion FPS independent. */
 public update(age:number):void{
  for(const [i,piece]of this.#pieces.entries()){
   const t=Math.max(0,age-piece.delay),angle=piece.spin*t,co=Math.cos(angle),si=Math.sin(angle),soft=this.#material==="vapor"?1+t*.5:1;
   const squeeze=this.#material==="liquid"?1+t*.7:1;
   const dx=piece.vx*t,dy=piece.vy*t-this.#gravity*t*t/2;
   for(let v=0;v<SURFACE_FRAGMENT_VERTICES;v++){
    const n=(i*SURFACE_FRAGMENT_VERTICES+v)*3,x=(this.#rest[n]??0)-piece.center.x,y=(this.#rest[n+1]??0)-piece.center.y;
    this.positions[n]=piece.center.x+(x*co-y*si)*soft/squeeze+dx;
    this.positions[n+1]=piece.center.y+(x*si+y*co)*soft*squeeze+(this.#reduced?dy*.1:dy);
    this.positions[n+2]=this.#reduced?0:Math.sin(angle*.7)*x*.12;
   }
  }
 }
}
