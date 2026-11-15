import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createEngine } from "./createEngine";
const state=vi.hoisted(()=>({version:2,calls:[] as {antialias:boolean;options:Record<string,unknown>}[],
  settings:{mode:"auto",compatibility:false,subscribe:()=>()=>{},setCompatibility(enabled:boolean){this.compatibility=enabled;}}}));
vi.mock("./GraphicsSettings",()=>({getGraphicsSettings:()=>state.settings}));
vi.mock("@babylonjs/core/Engines/webgpuEngine",()=>({WebGPUEngine:{IsSupportedAsync:Promise.resolve(false)}}));
vi.mock("@babylonjs/core/Engines/engine",async()=>{
  const {Observable}=await import("@babylonjs/core/Misc/observable");
  return {Engine:class{
    readonly webGLVersion=state.version;
    readonly onDisposeObservable=new Observable();readonly onContextLostObservable=new Observable();readonly onContextRestoredObservable=new Observable();
    disableVertexArrayObjects=false;
    constructor(_canvas:unknown,antialias:boolean,options:Record<string,unknown>){state.calls.push({antialias,options});}
    setHardwareScalingLevel():void{}
    dispose():void{this.onDisposeObservable.notifyObservers(undefined);}
  }};
});
beforeEach(()=>{
  state.calls=[];state.version=2;state.settings.mode="auto";state.settings.compatibility=false;
  vi.stubGlobal("navigator",{userAgent:"Android 14; Tablet; HuaweiBrowser",maxTouchPoints:5,deviceMemory:12,hardwareConcurrency:8});
  vi.stubGlobal("window",{location:{search:""},devicePixelRatio:2});vi.stubGlobal("document",{documentElement:{dataset:{}}});
});
afterEach(()=>{vi.unstubAllGlobals();});
function canvas(available:(kind:string)=>boolean=()=>true){
  const getContext=vi.fn((kind:string)=>available(kind)?{isContextLost:()=>false}:null);
  return {getContext,element:{getContext,getBoundingClientRect:()=>({width:1280,height:800}),dispatchEvent:vi.fn()} as unknown as HTMLCanvasElement};
}
it("avoids native MSAA, alpha and unused stencil buffers on a 12 GB tablet even in Auto",async()=>{
  const c=canvas(),result=await createEngine(c.element);
  expect(result.renderer).toBe("webgl2");expect(state.calls).toHaveLength(1);
  expect(state.calls[0]).toMatchObject({antialias:false,options:{alpha:false,stencil:false,powerPreference:"default",disableWebGL2Support:false}});
  result.engine.dispose();
});
it("starts directly on WebGL1 with conservative buffers when compatibility is selected",async()=>{
  state.version=1;state.settings.compatibility=true;state.settings.mode="ultra";
  const c=canvas(),result=await createEngine(c.element);
  expect(c.getContext.mock.calls[0]?.[0]).toBe("webgl");expect(result.renderer).toBe("webgl1");
  expect(state.calls[0]).toMatchObject({antialias:false,options:{disableWebGL2Support:true}});
  expect(document.documentElement.dataset.graphicsCompatibility).toBe("true");result.engine.dispose();
});
it("accepts a browser's WebGL1 fallback instead of falsely rejecting all WebGL support",async()=>{
  state.version=1;const c=canvas(kind=>kind==="webgl"),result=await createEngine(c.element);
  expect(result.renderer).toBe("webgl1");expect(document.documentElement.dataset.graphicsCompatibility).toBe("true");result.engine.dispose();
});
it("does not allocate Babylon engines on repeated failed GPU context creation",async()=>{
  const c=canvas(()=>false);
  for(let retry=0;retry<3;retry++)await expect(createEngine(c.element)).rejects.toThrow("Включи совместимость");
  expect(state.calls).toHaveLength(0);
});
