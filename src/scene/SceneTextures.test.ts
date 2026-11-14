import {afterEach,expect,it,vi} from "vitest";
import type {Scene} from "@babylonjs/core/scene";
import {sceneryTexture,isRetainedSceneryTexture} from "./SceneTextures";

// Model Babylon's important failure behavior: wrappers share one cached
// InternalTexture, but a newly constructed wrapper does not replay its old error.
const network=vi.hoisted(()=>{
 class Once{
  readonly callbacks:(()=>void)[]=[];
  public addOnce(callback:()=>void):void{this.callbacks.push(callback);}
  public notify():void{for(const callback of this.callbacks.splice(0))callback();}
 }
 interface Internal{refs:number;ready:boolean}
 const internals=new Map<string,Internal>(),attempts=new Map<string,number>();
 const instances:MockTexture[]=[];
 class MockTexture{
  public static readonly BILINEAR_SAMPLINGMODE=2;
  public readonly onDisposeObservable=new Once();
  public loadingError=false;
  public disposed=false;
  public readonly internal:Internal;
  public constructor(public readonly url:string,_scene:unknown,_mipmap:boolean,_invert:boolean,_sampling:number,_loaded?:unknown,
   private readonly onError?:()=>void){
   let internal=internals.get(url);
   if(!internal){internal={refs:0,ready:false};internals.set(url,internal);attempts.set(url,(attempts.get(url)??0)+1);}
   this.internal=internal;internal.refs++;instances.push(this);
  }
  public isReady():boolean{return !this.disposed&&this.internal.ready;}
  public fail():void{this.loadingError=true;this.onError?.();}
  public dispose():void{
   if(this.disposed)return;this.disposed=true;this.internal.refs--;
   if(this.internal.refs===0&&internals.get(this.url)===this.internal)internals.delete(this.url);
   this.onDisposeObservable.notify();
  }
 }
 return{MockTexture,instances,attempts,internals,scene:()=>({onDisposeObservable:new Once()}),
  fail:(url:string)=>{for(const texture of instances.filter(t=>t.url===url&&!t.disposed))texture.fail();},
  load:(url:string)=>{const internal=internals.get(url);if(internal)internal.ready=true;},
 };
});
vi.mock("@babylonjs/core/Materials/Textures/texture",()=>({Texture:network.MockTexture}));
afterEach(()=>{for(const texture of network.instances)texture.dispose();network.instances.length=0;network.attempts.clear();network.internals.clear();});

it("retries a previously failed scenery image after its run lease has been released",()=>{
 const scene=network.scene() as unknown as Scene,url="ruins-distance.png",failed=vi.fn(),retryFailed=vi.fn();
 const first=sceneryTexture(url,scene,failed),owner=network.instances[0];
 network.fail(url);expect(failed).toHaveBeenCalledOnce();expect(owner?.loadingError).toBe(true);
 first.dispose();
 const retry=sceneryTexture(url,scene,retryFailed);
 expect(network.attempts.get(url)).toBe(2);expect(owner?.disposed).toBe(true);
 network.load(url);expect(retry.isReady()).toBe(true);expect(retryFailed).not.toHaveBeenCalled();
});
it("evicts still-held failed leases so they cannot trap a retry on Babylon's failed internal cache",()=>{
 const scene=network.scene() as unknown as Scene,url="ruins-scenery-atlas.png";
 const first=sceneryTexture(url,scene,vi.fn()),second=sceneryTexture(url,scene,vi.fn());
 network.fail(url);const failedWrappers=network.instances.slice();
 const retryFailure=vi.fn(),retry=sceneryTexture(url,scene,retryFailure);
 expect(failedWrappers.every(texture=>texture.disposed)).toBe(true);
 expect(network.attempts.get(url)).toBe(2);
 network.fail(url);expect(retryFailure).toHaveBeenCalledOnce();expect(retry.loadingError).toBe(true);
 first.dispose();second.dispose();
});
it("retains a healthy image owner while successful run leases keep sharing the same GPU image",()=>{
 const scene=network.scene() as unknown as Scene,url="healthy.png";
 const first=sceneryTexture(url,scene),second=sceneryTexture(url,scene),owner=network.instances[0];
 network.load(url);expect(first.isReady()).toBe(true);expect(second.isReady()).toBe(true);
 expect(isRetainedSceneryTexture(first)).toBe(false);
 if(!owner)throw Error("Missing retained owner");
 expect(isRetainedSceneryTexture(owner as unknown as typeof first)).toBe(true);
 first.dispose();expect(second.isReady()).toBe(true);expect(owner.disposed).toBe(false);
 expect(network.attempts.get(url)).toBe(1);
});
