export const WATER_SPLASH_SECONDS = 1.35;
export const WATER_SHEET_COLUMNS = 10, WATER_SHEET_ROWS = 8;
const DROPS = 12, JETS = 2, JET_SEGMENTS = 8;
const CHILDREN = DROPS*2, FRAGMENTS = WATER_SHEET_COLUMNS*WATER_SHEET_ROWS;
const CHILD_START=DROPS+JETS*JET_SEGMENTS,FRAGMENT_START=CHILD_START+CHILDREN;
const QUADS = FRAGMENT_START+FRAGMENTS+1;
const clamp01 = (x:number):number => Math.max(0,Math.min(1,x));
const smooth01 = (x:number):number => {const t=clamp01(x);return t*t*(3-2*t);};

/** Fixed batches carry a connected sheet into drifting water fragments, while
 * the large ballistic drops split into smaller drops along the same trajectory. */
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
  for(let i=0;i<FRAGMENTS;i++){
   const col=i%WATER_SHEET_COLUMNS,row=Math.floor(i/WATER_SHEET_COLUMNS);
   const u=(col+.5)/WATER_SHEET_COLUMNS,v=(row+.5)/WATER_SHEET_ROWS;
   const du=1.25/WATER_SHEET_COLUMNS,dv=1.25/WATER_SHEET_ROWS;
   this.uvs.set([u-du,v-dv,u+du,v-dv,u+du,v+dv,u-du,v+dv],(FRAGMENT_START+i)*8);
  }
 }
 public update(age:number,force:number,contactX:number,groundY:number,reduced:boolean,centered=false):number{
  this.positions.fill(0);this.waterData.fill(0);
  if(!Number.isFinite(age)||age<0||age>=WATER_SPLASH_SECONDS)return 0;
  // Center unused quads at the hit as well, keeping the batch bounds local.
  for(let i=0;i<QUADS*4;i++){this.positions[i*3]=contactX;this.positions[i*3+1]=groundY;}
  const motion=reduced ? .3 : 1,power=.8+Math.max(.7,Math.min(1.6,force))*.3;
  for(let i=0;i<DROPS;i++){
   if(reduced&&i>=4)continue;
   const band=Math.floor(i/2),direction=i%2===0?-1:1;
   const spread=(band*.618+.20)%1,lift=(band*.414+.13)%1;
   const born=age-lift*.035;if(born<0)continue;
   const t=born*.85;
   const vx=direction*(1.3+spread*4.1)*power*motion;
   const vy=(3.2+lift*3.3)*power*motion,gravity=6.8*motion;
   const x=contactX+vx*t,y=groundY+vy*t-gravity*t*t;
   const speedY=vy-2*gravity*t,speed=Math.max(.01,Math.hypot(vx,speedY));
   const radius=(band>=4 ? .055+spread*.035 : .105+spread*.08)*(reduced ? .8 : 1);
   const length=radius*(1.3+Math.min(1.5,speed*.18));
   const split=.40+band*.024,splitFade=smooth01((born-split)/.12);
   this.#drop(i,x,y,radius*(1-splitFade*.65),length*(1-splitFade*.65),vx/speed,speedY/speed,smooth01(born/.065)*(1-splitFade));
   if(born<split)continue;
   for(let child=0;child<2;child++){
    const dt=born-split,side=child===0?-1:1;
    const dx=side*(.35+spread*.6)*motion,dy=(child===0?.45:-.25)*motion;
    const fade=smooth01(dt/.12)*smooth01((.70+lift*.12-dt)/.30);
    const shrink=1-smooth01(dt/.80)*.80;
    this.#drop(CHILD_START+i*2+child,x+dx*dt,y+dy*dt,radius*.45*shrink,radius*.58*shrink,
     vx/speed,speedY/speed,fade);
   }
  }
  const jetFade=smooth01(age/.065)*smooth01((.38-age)/.20);
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
     (.065+band*.012)*(1-s/JET_SEGMENTS*.72),(.065+band*.012)*(1-(s+1)/JET_SEGMENTS*.72),jetFade*.35);
   }
  }
  const growth=smooth01(age/.28);
  const sheetMotion=reduced?.55:1;
  const width=(.65+growth*3.8)*power*sheetMotion;
  const height=(.45+growth*3.3)*power*sheetMotion;
  // A broken bubble opens around its visual center. A surviving bubble still
  // splashes from the contact surface (the illustrated root is at UV .5,.185).
  // The illustration's alpha-weighted center is (.494,.415), below the quad's
  // midpoint because the broad liquid folds carry more mass than the tips.
  const anchorX=centered?.494:.5,anchorY=centered?.415:.185;
  const left=contactX-width*anchorX,right=contactX+width*(1-anchorX);
  const bottom=groundY-height*anchorY,top=groundY+height*(1-anchorY);
  // Match the shader's cell schedule: each piece starts exactly where the
  // connected sheet loses that cell, then drifts apart and shrinks into spray.
  for(let i=0;i<FRAGMENTS;i++){
   if(reduced&&i%4!==0)continue;
   const col=i%WATER_SHEET_COLUMNS,row=Math.floor(i/WATER_SHEET_COLUMNS);
   const seed=((col*7+row*13)%17)/16,start=.30+seed*.20,dt=age-start;
   if(dt<0)continue;
   const life=.65+seed*.20;if(dt>=life)continue;
   const u=(col+.5)/WATER_SHEET_COLUMNS,v=(row+.5)/WATER_SHEET_ROWS;
   const drift=Math.max(0,dt-.04),shrink=1-smooth01(dt/life)*.94;
   const x=left+u*width+((u-.5)*2.2+(seed-.5)*.35)*drift*motion;
   const y=bottom+v*height+((v-.4)*1.5+.5)*drift*motion-1.3*drift*drift*motion;
   const halfWidth=width/WATER_SHEET_COLUMNS*1.25*shrink,halfHeight=height/WATER_SHEET_ROWS*1.25*shrink;
   this.#quad(FRAGMENT_START+i,x-halfWidth,y-halfHeight,x+halfWidth,y-halfHeight,
    x+halfWidth,y+halfHeight,x-halfWidth,y+halfHeight,3+i+smooth01(dt/life)*.49,smooth01(dt/.08)*smooth01((life-dt)/.30));
  }
  this.#quad(QUADS-1,left,bottom,right,bottom,
   right,top,left,top,2,smooth01(age/.10));
  return smooth01((WATER_SPLASH_SECONDS-age)/.25);
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
