import { afterEach, expect, it, vi } from "vitest";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { Scene } from "@babylonjs/core/scene";
import { GraphicsSettings } from "./GraphicsSettings";
import { mobileGraphicsDevice, watchGraphicsContext, GRAPHICS_LOST_EVENT, GRAPHICS_RESTORED_EVENT, GRAPHICS_DISPOSED_EVENT, GRAPHICS_FAILED_EVENT } from "./GraphicsContext";
afterEach(()=>{vi.useRealTimers();});

it("recognises tablets without treating RAM size or Windows touch support as graphics capability", () => {
  for (const userAgent of ["Android 14; Tablet", "OpenHarmony; HuaweiBrowser", "iPad", "Macintosh; Intel Mac OS X"])
    expect(mobileGraphicsDevice({userAgent,maxTouchPoints:5})).toBe(true);
  expect(mobileGraphicsDevice({userAgent:"Windows NT 10.0",maxTouchPoints:10})).toBe(false);
  expect(mobileGraphicsDevice({userAgent:"Macintosh; Intel Mac OS X",maxTouchPoints:0})).toBe(false);
});

it("signals a real loss/restoration, remembers a safe restart and does not erase quality, coins or purchases", () => {
  vi.useFakeTimers();
  const data = new Map([["speed-fall-ball.profile.v1","coins and purchases"]]);
  const storage = {getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>{data.set(key,value);}};
  const settings = new GraphicsSettings(()=>storage);settings.set("high");
  const engine = new NullEngine(), canvas = new EventTarget() as HTMLCanvasElement, events:string[]=[];
  for (const name of [GRAPHICS_LOST_EVENT,GRAPHICS_RESTORED_EVENT,GRAPHICS_DISPOSED_EVENT]) canvas.addEventListener(name,()=>{events.push(name);});
  watchGraphicsContext(engine,canvas,settings);
  engine.onContextLostObservable.notifyObservers(engine);
  expect(events).toEqual([GRAPHICS_LOST_EVENT]);expect(new GraphicsSettings(()=>storage).compatibility).toBe(true);
  expect(settings.mode).toBe("high");expect(data.get("speed-fall-ball.profile.v1")).toBe("coins and purchases");
  engine.onContextRestoredObservable.notifyObservers(engine);vi.runOnlyPendingTimers();expect(events.at(-1)).toBe(GRAPHICS_RESTORED_EVENT);
  engine.dispose();expect(events.at(-1)).toBe(GRAPHICS_DISPOSED_EVENT);
  engine.onContextLostObservable.notifyObservers(engine);expect(events).toHaveLength(3);
});

it("keeps recovery visible until scene resources are ready and reports a bounded failure",()=>{
  vi.useFakeTimers();const engine=new NullEngine(),scene=new Scene(engine),canvas=new EventTarget() as HTMLCanvasElement;
  const ready=vi.spyOn(scene,"isReady").mockReturnValue(false),restored=vi.fn(),failed=vi.fn();
  canvas.addEventListener(GRAPHICS_RESTORED_EVENT,restored);canvas.addEventListener(GRAPHICS_FAILED_EVENT,failed);
  watchGraphicsContext(engine,canvas,new GraphicsSettings(()=>{throw Error("No storage");}));
  engine.onContextRestoredObservable.notifyObservers(engine);vi.advanceTimersByTime(1000);expect(restored).not.toHaveBeenCalled();
  ready.mockReturnValue(true);vi.advanceTimersByTime(100);expect(restored).toHaveBeenCalledOnce();
  ready.mockReturnValue(false);engine.onContextLostObservable.notifyObservers(engine);engine.onContextRestoredObservable.notifyObservers(engine);
  vi.advanceTimersByTime(10_100);expect(failed).toHaveBeenCalledOnce();expect(restored).toHaveBeenCalledOnce();
  engine.onContextRestoredObservable.notifyObservers(engine);engine.dispose();vi.advanceTimersByTime(20_000);expect(failed).toHaveBeenCalledOnce();
});

it("rejects a ready scene when the restored GPU cannot draw it",()=>{
  vi.useFakeTimers();
  const engine=new NullEngine(),scene=new Scene(engine),restored=vi.fn(),failed=vi.fn();
  let drawError=0;
  const gl={NO_ERROR:0,isContextLost:()=>false,getError:()=>drawError};
  const canvas=Object.assign(new EventTarget(),{getContext:()=>gl}) as unknown as HTMLCanvasElement;
  vi.spyOn(engine,"getRenderingCanvas").mockReturnValue(canvas);
  vi.spyOn(scene,"isReady").mockReturnValue(true);
  const render=vi.spyOn(scene,"render").mockImplementation(()=>{drawError=1282;});
  canvas.addEventListener(GRAPHICS_RESTORED_EVENT,restored);canvas.addEventListener(GRAPHICS_FAILED_EVENT,failed);
  watchGraphicsContext(engine,canvas,new GraphicsSettings(()=>{throw Error("No storage");}));
  engine.onContextRestoredObservable.notifyObservers(engine);vi.runOnlyPendingTimers();
  expect(render).toHaveBeenCalledWith(false,true);
  expect(restored).not.toHaveBeenCalled();expect(failed).toHaveBeenCalledOnce();
  engine.dispose();
});
