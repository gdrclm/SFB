export const WATER_SPLASH_SECONDS = .9;
const DROPS = 24, JETS = 6, JET_SEGMENTS = 10, CROWN = 12, RING = 32;
const QUADS = DROPS + JETS * JET_SEGMENTS + CROWN + RING;
const clamp01 = (x:number):number => Math.max(0,Math.min(1,x));

/** One persistent batch: ballistic teardrops, tapering water jets, a short crown
 * and an expanding ripple. Opacity is per vertex; hidden slots allocate nothing. */
export class WaterSplashGeometry {
 readonly positions = new Float32Array(QUADS*12);
 readonly waterData = new Float32Array(QUADS*8);
 readonly uvs = new Float32Array(QUADS*8);
 readonly indices:number[]=[];
 public constructor(){
  for(let i=0;i<QUADS;i++){
   this.uvs.set([0,0,1,0,1,1,0,1],i*8);
   const n=i*4;this.indices.push(n,n+1,n+2,n,n+2,n+3);
  }
 }
 public update(age:number,force:number,contactX:number,groundY:number,reduced:boolean):number{
  this.positions.fill(0);this.waterData.fill(0);
  if(!Number.isFinite(age)||age<0||age>=WATER_SPLASH_SECONDS)return 0;
  // Center unused quads at the hit as well, keeping the batch bounds local.
  for(let i=0;i<QUADS*4;i++){this.positions[i*3]=contactX;this.positions[i*3+1]=groundY;}
  const motion=reduced ? .3 : 1,power=.8+Math.max(.7,Math.min(1.6,force))*.3;
  for(let i=0;i<DROPS;i++){
   if(reduced&&i>=8)continue;
   const band=Math.floor(i/2),direction=i%2===0?-1:1;
   const spread=(band*.618+.20)%1,lift=(band*.414+.13)%1;
   const t=age-lift*.035;if(t<0)continue;
   const vx=direction*(1.3+spread*4.1)*power*motion;
   const vy=(3.2+lift*3.3)*power*motion,gravity=6.8*motion;
   const x=contactX+vx*t,y=groundY+vy*t-gravity*t*t;
   const speedY=vy-2*gravity*t,speed=Math.max(.01,Math.hypot(vx,speedY));
   const radius=(band>=7 ? .025+spread*.024 : .055+spread*.055)*(reduced ? .8 : 1);
   const length=radius*(1.3+Math.min(1.5,speed*.18));
   this.#drop(i,x,y,radius,length,vx/speed,speedY/speed,clamp01((.88-t)/.2));
  }
  const jetFade=clamp01((.47-age)/.16);
  for(let jet=0;jet<JETS;jet++){
   if(reduced&&jet>=2)continue;
   const direction=jet%2===0?-1:1,band=Math.floor(jet/2);
   const vx=direction*(2.8+band*.65)*power*motion,vy=(4.2+band*.7)*power*motion;
   const tail=Math.max(0,age-.16),head=Math.min(age,.34);
   for(let s=0;s<JET_SEGMENTS;s++){
    const slot=DROPS+jet*JET_SEGMENTS+s;
    if(head<=tail||jetFade===0)continue;
    const a=tail+(head-tail)*s/JET_SEGMENTS,b=tail+(head-tail)*(s+1)/JET_SEGMENTS;
    this.#ribbon(slot,contactX+vx*a,groundY+vy*a-6.8*motion*a*a,
     contactX+vx*b,groundY+vy*b-6.8*motion*b*b,
     (.065+band*.012)*(1-s/JET_SEGMENTS*.72),(.065+band*.012)*(1-(s+1)/JET_SEGMENTS*.72),jetFade*.9);
   }
  }
  const crownFade=clamp01(1-age/.23),crownWidth=(.14+age*7)*motion;
  for(let i=0;i<CROWN;i++){
   const slot=DROPS+JETS*JET_SEGMENTS+i;
   const a=i*Math.PI/CROWN,b=(i+1)*Math.PI/CROWN;
   const height=(.25+age*3.2)*motion,spike=i%2===0?1.22:.8;
   this.#quad(slot,
    contactX+Math.cos(a)*crownWidth*.65,groundY+Math.sin(a)*height*.32,
    contactX+Math.cos(b)*crownWidth*.65,groundY+Math.sin(b)*height*.32,
    contactX+Math.cos(b)*crownWidth,groundY+Math.sin(b)*height*spike,
    contactX+Math.cos(a)*crownWidth,groundY+Math.sin(a)*height*spike,1,crownFade*.85);
  }
  const rippleFade=clamp01(1-age/.65),rx=(.25+age*3.5)*motion,ry=(.08+age*.42)*motion;
  for(let i=0;i<RING;i++){
   const a=i*Math.PI*2/RING,b=(i+1)*Math.PI*2/RING;
   this.#ribbon(DROPS+JETS*JET_SEGMENTS+CROWN+i,
    contactX+Math.cos(a)*rx,groundY+Math.sin(a)*ry,
    contactX+Math.cos(b)*rx,groundY+Math.sin(b)*ry,.035*rippleFade,.035*rippleFade,rippleFade*.65);
  }
  return clamp01((WATER_SPLASH_SECONDS-age)/.25);
 }
 #drop(slot:number,x:number,y:number,halfWidth:number,halfLength:number,vx:number,vy:number,alpha:number):void{
  const ax=vy*halfWidth,ay=-vx*halfWidth,bx=vx*halfLength,by=vy*halfLength;
  this.#quad(slot,x-ax-bx,y-ay-by,x+ax-bx,y+ay-by,x+ax+bx,y+ay+by,x-ax+bx,y-ay+by,0,alpha);
 }
 #ribbon(slot:number,ax:number,ay:number,bx:number,by:number,wa:number,wb:number,alpha:number):void{
  const length=Math.max(.0001,Math.hypot(bx-ax,by-ay)),nx=-(by-ay)/length,ny=(bx-ax)/length;
  this.#quad(slot,ax-nx*wa,ay-ny*wa,ax+nx*wa,ay+ny*wa,bx+nx*wb,by+ny*wb,bx-nx*wb,by-ny*wb,1,alpha);
 }
 #quad(slot:number,ax:number,ay:number,bx:number,by:number,cx:number,cy:number,dx:number,dy:number,shape:number,alpha:number):void{
  const p=slot*12;this.positions[p]=ax;this.positions[p+1]=ay;this.positions[p+2]=0;
  this.positions[p+3]=bx;this.positions[p+4]=by;this.positions[p+5]=0;
  this.positions[p+6]=cx;this.positions[p+7]=cy;this.positions[p+8]=0;
  this.positions[p+9]=dx;this.positions[p+10]=dy;this.positions[p+11]=0;
  for(let i=0;i<4;i++){this.waterData[slot*8+i*2]=shape;this.waterData[slot*8+i*2+1]=alpha;}
 }
}
