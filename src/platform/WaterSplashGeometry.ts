export const WATER_SPLASH_SECONDS = .9;
const SHEET=40, TENDRILS=28, STEPS=5, BRANCHES=18, BRANCH_STEPS=2, DROPS=44, GLINTS=18;
const TENDRIL_START=SHEET, BRANCH_START=TENDRIL_START+TENDRILS*STEPS;
const DROP_START=BRANCH_START+BRANCHES*BRANCH_STEPS, GLINT_START=DROP_START+DROPS;
const QUADS=GLINT_START+GLINTS, TAU=Math.PI*2;
const clamp01=(x:number):number=>Math.max(0,Math.min(1,x));
const easeOut=(x:number):number=>1-Math.pow(1-clamp01(x),3);
const hash=(n:number):number=>{const v=Math.sin(n*127.1+78.233)*43758.5453;return v-Math.floor(v);};

/** Reusable one-mesh splash; 0=drop, 1=sheet, 2=filament, 3=highlight. */
export class WaterSplashGeometry {
 readonly positions = new Float32Array(QUADS*12);
 readonly waterData = new Float32Array(QUADS*8);
 readonly uvs = new Float32Array(QUADS*8);
 readonly indices:number[]=[];
 public constructor(){for(let i=0;i<QUADS;i++){this.uvs.set([0,0,1,0,1,1,0,1],i*8);const n=i*4;this.indices.push(n,n+1,n+2,n,n+2,n+3);}}
  /** Animated hand-drawn radial splat: irregular fluid sheets, split tendrils,
   * specular strokes and heavy droplets. One fixed mesh/typed buffer set. */
  public update(age:number,force:number,contactX:number,groundY:number,reduced:boolean):number{
    this.positions.fill(0);this.waterData.fill(0);
    if(!Number.isFinite(age)||age<0||age>=WATER_SPLASH_SECONDS)return 0;
    for(let i=0;i<QUADS*4;i++){this.positions[i*3]=contactX;this.positions[i*3+1]=groundY;}
    const strength=.84+Math.max(.7,Math.min(1.6,Number.isFinite(force)?force:1))*.23;
    const motion=reduced?.3:1,expansion=easeOut(age/.22);
    const radius=(.19+expansion*2.15)*strength*motion;
    const sheetAlpha=clamp01((.37-age)/.22),tendrilAlpha=clamp01((.59-age)/.27);
    const branchAlpha=clamp01((.51-age)/.23);
    // Jagged sheet opens in <200ms. Some sectors tear away into transparent voids.
    const count=reduced?12:SHEET;
    for(let i=0;i<count;i++){
      const index=reduced?i*3:i;
      const a=-Math.PI+index*TAU/SHEET,b=a+TAU/SHEET*(reduced?2.4:.97);
      const detail=hash(index+22);
      if(age>.08&&index%13===4)continue;
      const reach=radius*(.49+detail*.53)*(1+.15*Math.sin((a+b)*2.7+.8));
      const inner=Math.min(.14,reach*.18);
      const angle=(a+b)*.5+(hash(index+97)-.5)*.07;
      const tipA=reach*(.86+hash(index+81)*.15),tipB=reach*(.76+hash(index+129)*.24)*.9;
      this.#quad(index,contactX+Math.cos(a)*inner,groundY+Math.sin(a)*inner,
        contactX+Math.cos(b)*inner,groundY+Math.sin(b)*inner,
        contactX+Math.cos(b)*tipB,groundY+Math.sin(b)*tipB,
        contactX+Math.cos(angle)*tipA,groundY+Math.sin(angle)*tipA,
        1,sheetAlpha*(.75+detail*.25));
    }
    // Long asymmetric hooked tendrils; links drop out to make lace-like holes.
    for(let i=0;i<TENDRILS;i++){
      if(reduced&&i%4!==0)continue;
      const angle=i*TAU/TENDRILS+(hash(i+17)-.5)*.43;
      const range=radius*(.7+hash(i+64)*.72)*(1+.12*Math.sin(angle*3.1+.6));
      const bend=(hash(i+197)-.5)*.38;
      for(let s=0;s<STEPS;s++){
        if(age>.16&&s===2&&i%3===0)continue;
        if(age>.24&&s===0&&i%2===0)continue;
        if(age>.34&&s<=1)continue;
        const t0=s/STEPS,t1=(s+1)/STEPS;
        const a0=angle+bend*t0*t0,a1=angle+bend*t1*t1;
        const x0=contactX+Math.cos(a0)*range*t0,y0=groundY+Math.sin(a0)*range*t0;
        const x1=contactX+Math.cos(a1)*range*t1,y1=groundY+Math.sin(a1)*range*t1;
        const base=(.12+hash(i+307)*.055)*motion;
        const w0=base*Math.pow(1-t0,1.12),w1=base*Math.pow(1-t1,1.12)+.004*motion;
        this.#ribbon(TENDRIL_START+i*STEPS+s,x0,y0,x1,y1,w0,w1,
          tendrilAlpha*(.78+hash(i+401)*.22),2);
      }
    }
    // Side branches change the silhouette from a geometric star into torn water.
    for(let i=0;i<BRANCHES;i++){
      if(reduced&&i%5!==0)continue;
      const arm=Math.floor(i*TENDRILS/BRANCHES);
      const angle=arm*TAU/TENDRILS,branchAt=.36+hash(i+499)*.25;
      const ox=contactX+Math.cos(angle)*radius*branchAt;
      const oy=groundY+Math.sin(angle)*radius*branchAt;
      const direction=angle+(i%2===0?-1:1)*(.3+hash(i+571)*.47);
      const length=radius*(.26+hash(i+609)*.23);
      for(let s=0;s<BRANCH_STEPS;s++){
        const t0=s/BRANCH_STEPS,t1=(s+1)/BRANCH_STEPS;
        const x0=ox+Math.cos(direction+t0*.15)*length*t0;
        const y0=oy+Math.sin(direction+t0*.15)*length*t0;
        const x1=ox+Math.cos(direction+t1*.15)*length*t1;
        const y1=oy+Math.sin(direction+t1*.15)*length*t1;
        this.#ribbon(BRANCH_START+i*BRANCH_STEPS+s,x0,y0,x1,y1,
          (.075-.05*t0)*motion,(.075-.05*t1)*motion,branchAlpha*.92,2);
      }
    }
    // Deterministically staggered droplets fly radially, then arc with gravity.
    for(let i=0;i<DROPS;i++){
      if(reduced&&i>=9)continue;
      const big=i<12,angle=(i+.4)*TAU/DROPS+(hash(i+713)-.5)*.3;
      const delay=(big?.035:.08)+hash(i+731)*(big?.06:.14);
      const t=age-delay;if(t<=0)continue;
      const speed=(big?5:6.1)*(.68+hash(i+761)*.65)*strength*motion;
      const dist=.46*expansion*motion+speed*t;
      const x=contactX+Math.cos(angle)*dist,y=groundY+Math.sin(angle)*dist-4.1*t*t*motion;
      const vx=Math.cos(angle)*speed,vy=Math.sin(angle)*speed-8.2*t*motion;
      const norm=Math.max(.001,Math.hypot(vx,vy));
      const size=(big?.075+hash(i+787)*.065:.018+hash(i+811)*.03)*motion;
      const alpha=clamp01(((big?.79:.68)-age)/.26);
      if(alpha>0)this.#drop(DROP_START+i,x,y,size,size*(big?1.7:1.25),vx/norm,vy/norm,alpha);
    }
    // Slim white/cyan strokes supply the specular highlights of a painted splash.
    if(!reduced){
      const fade=clamp01((.38-age)/.21);
      for(let i=0;i<GLINTS&&fade>0;i++){
        const a=i*TAU/GLINTS+.18;
        const inner=.15+hash(i+863)*.35,outer=inner+.08+hash(i+887)*.14;
        this.#ribbon(GLINT_START+i,
          contactX+Math.cos(a)*radius*inner,groundY+Math.sin(a)*radius*inner,
          contactX+Math.cos(a+.12)*radius*outer,groundY+Math.sin(a+.12)*radius*outer,
          .022,.008,fade*.9,3);
      }
    }
    return clamp01((WATER_SPLASH_SECONDS-age)/.18);
  }
 #drop(slot: number, x: number, y: number, halfWidth: number, halfLength: number, vx: number, vy: number, alpha: number): void {
    const ax = vy * halfWidth, ay = -vx * halfWidth;
    const bx = vx * halfLength, by = vy * halfLength;
    this.#quad(slot, x - ax - bx, y - ay - by, x + ax - bx, y + ay - by,
      x + ax + bx, y + ay + by, x - ax + bx, y - ay + by, 0, alpha);
  }

  #ribbon(slot: number, ax: number, ay: number, bx: number, by: number, wa: number, wb: number, alpha: number, shape = 1): void {
    const length = Math.max(.0001, Math.hypot(bx - ax, by - ay));
    const nx = -(by - ay) / length, ny = (bx - ax) / length;
    this.#quad(slot, ax - nx * wa, ay - ny * wa, ax + nx * wa, ay + ny * wa,
      bx + nx * wb, by + ny * wb, bx - nx * wb, by - ny * wb, shape, alpha);
  }

  #quad(slot: number, ax: number, ay: number, bx: number, by: number, cx: number, cy: number,
    dx: number, dy: number, shape: number, alpha: number): void {
    const p = slot * 12;
    this.positions[p] = ax; this.positions[p + 1] = ay; this.positions[p + 2] = 0;
    this.positions[p + 3] = bx; this.positions[p + 4] = by; this.positions[p + 5] = 0;
    this.positions[p + 6] = cx; this.positions[p + 7] = cy; this.positions[p + 8] = 0;
    this.positions[p + 9] = dx; this.positions[p + 10] = dy; this.positions[p + 11] = 0;
    for (let i = 0; i < 4; i++) {
      this.waterData[slot * 8 + i * 2] = shape;
      this.waterData[slot * 8 + i * 2 + 1] = alpha;
    }
  }
}
