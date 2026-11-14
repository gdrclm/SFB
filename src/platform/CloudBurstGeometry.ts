export const CLOUD_BURST_SECONDS=1.25;
const PUFFS=12;
const clamp01=(x:number):number=>Math.max(0,Math.min(1,x));
const smooth01=(x:number):number=>{const t=clamp01(x);return t*t*(3-2*t);};

/** The two halves stay on the cloud body; this fixed batch carries their soft
 * lobes away after the impact wave reaches each part of the cloud. */
export function cloudSplitGap(age:number,force:number,reduced:boolean):number{
 return smooth01((age-.08)/.40)*(.48+force*.22)*(reduced?.25:1);
}
export class CloudBurstGeometry {
 readonly positions=new Float32Array(PUFFS*12);
 readonly waterData=new Float32Array(PUFFS*8);
 readonly uvs=new Float32Array(PUFFS*8);
 readonly indices:number[]=[];
 public constructor(){
  for(let i=0;i<PUFFS;i++){
   this.uvs.set([0,0,1,0,1,1,0,1],i*8);
   const n=i*4;this.indices.push(n,n+1,n+2,n,n+2,n+3);
  }
 }
 public update(age:number,width:number,contactX:number,centerY:number,force:number,reduced:boolean):number{
  this.positions.fill(0);this.waterData.fill(0);
  if(!Number.isFinite(age)||age<0||age>=CLOUD_BURST_SECONDS)return 0;
  const motion=reduced?.25:1;
  for(let i=0;i<PUFFS;i++){
   if(reduced&&i%3!==0)continue;
   const seed=(i*.618+.2)%1,sourceX=((i+.5)/PUFFS-.5)*width*.82;
   const born=.22+Math.abs(sourceX-contactX)/9+seed*.035,t=age-born;
   if(t<=0)continue;
   const side=sourceX<contactX?-1:1,life=.65+seed*.13;
   if(t>=life)continue;
   const gap=cloudSplitGap(age,force,reduced);
   const x=sourceX+side*(gap+t*(.45+seed*.65)*motion);
   const y=centerY+.04+Math.sin(i*2.4)*.20+t*(.10+seed*1.1)*motion+Math.sin(t*6+i)*.10*motion;
   const radius=(.30+seed*.16)*(1+smooth01(t/.22)*.40)*(1-smooth01((t-life+.3)/.3)*.65);
   const w=radius*(1+seed*.3),h=radius*.9;
   const p=i*12;
   this.positions[p]=x-w;this.positions[p+1]=y-h;
   this.positions[p+3]=x+w;this.positions[p+4]=y-h;
   this.positions[p+6]=x+w;this.positions[p+7]=y+h;
   this.positions[p+9]=x-w;this.positions[p+10]=y+h;
   const alpha=smooth01(t/.13)*smooth01((life-t)/.32);
   for(let v=0;v<4;v++){this.waterData[i*8+v*2]=0;this.waterData[i*8+v*2+1]=alpha;}
  }
  return 1;
 }
}
