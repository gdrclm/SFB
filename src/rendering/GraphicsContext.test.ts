import { expect, it } from "vitest";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { GraphicsSettings } from "./GraphicsSettings";
import { mobileGraphicsDevice, watchGraphicsContext, GRAPHICS_LOST_EVENT, GRAPHICS_RESTORED_EVENT, GRAPHICS_DISPOSED_EVENT } from "./GraphicsContext";

it("recognises tablets without treating RAM size or Windows touch support as graphics capability", () => {
  for (const userAgent of ["Android 14; Tablet", "OpenHarmony; HuaweiBrowser", "iPad", "Macintosh; Intel Mac OS X"])
    expect(mobileGraphicsDevice({userAgent,maxTouchPoints:5})).toBe(true);
  expect(mobileGraphicsDevice({userAgent:"Windows NT 10.0",maxTouchPoints:10})).toBe(false);
  expect(mobileGraphicsDevice({userAgent:"Macintosh; Intel Mac OS X",maxTouchPoints:0})).toBe(false);
});

it("signals a real loss/restoration, remembers a safe restart and does not erase quality, coins or purchases", () => {
  const data = new Map([["speed-fall-ball.profile.v1","coins and purchases"]]);
  const storage = {getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>{data.set(key,value);}};
  const settings = new GraphicsSettings(()=>storage);settings.set("high");
  const engine = new NullEngine(), canvas = new EventTarget() as HTMLCanvasElement, events:string[]=[];
  for (const name of [GRAPHICS_LOST_EVENT,GRAPHICS_RESTORED_EVENT,GRAPHICS_DISPOSED_EVENT]) canvas.addEventListener(name,()=>{events.push(name);});
  watchGraphicsContext(engine,canvas,settings);
  engine.onContextLostObservable.notifyObservers(engine);
  expect(events).toEqual([GRAPHICS_LOST_EVENT]);expect(new GraphicsSettings(()=>storage).compatibility).toBe(true);
  expect(settings.mode).toBe("high");expect(data.get("speed-fall-ball.profile.v1")).toBe("coins and purchases");
  engine.onContextRestoredObservable.notifyObservers(engine);expect(events.at(-1)).toBe(GRAPHICS_RESTORED_EVENT);
  engine.dispose();expect(events.at(-1)).toBe(GRAPHICS_DISPOSED_EVENT);
  engine.onContextLostObservable.notifyObservers(engine);expect(events).toHaveLength(3);
});
