import { afterEach, expect, it, vi } from "vitest";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { initialQuality, renderScale, QualityBudget, AdaptiveQuality, getRenderQuality } from "./AdaptiveQuality";
import { GraphicsSettings } from "./GraphicsSettings";
afterEach(() => { vi.unstubAllGlobals(); });
const feed = (budget: QualityBudget, fps: number, seconds: number, active = true): void => {
  for (let i = 0; i < fps * seconds; i++) budget.observe(1 / fps, active);
};
it("starts conservatively on limited memory or CPUs without requiring device APIs", () => {
  expect(initialQuality(2, 8)).toBe("low");
  expect(initialQuality(undefined, 4)).toBe("low");
  expect(initialQuality(4, 8)).toBe("medium");
  expect(initialQuality(undefined, undefined)).toBe("high");
});
it("bounds high-DPI and large-screen framebuffer allocation", () => {
  for (const tier of ["high", "medium", "low"] as const) {
    const scale = renderScale(tier, 390, 844, 3);
    expect(390 * 844 / scale ** 2).toBeLessThan(390 * 844 * 3 ** 2 * .26);
    expect(3840 * 2160 / renderScale(tier, 3840, 2160, 2) ** 2).toBeLessThanOrEqual(1_500_001);
  }
  expect(renderScale("low", 390, 844, 3)).toBeGreaterThan(renderScale("high", 390, 844, 3));
});
it("drops quality on sustained slow frames and recovers gradually after stable play", () => {
  const budget = new QualityBudget("high");
  feed(budget, 30, 12); expect(budget.tier).toBe("low");
  feed(budget, 60, 10); expect(budget.tier).toBe("low");
  feed(budget, 60, 20); expect(budget.tier).toBe("medium");
});
it("does not lower quality for a single stall, pauses or returning from the background", () => {
  const budget = new QualityBudget("high");
  feed(budget, 60, 4); budget.observe(.2, true); feed(budget, 60, 3);
  expect(budget.tier).toBe("high");
  feed(budget, 10, 10, false); budget.observe(20, false);
  feed(budget, 60, 3); expect(budget.tier).toBe("high");
});

it("still degrades under severe continuous stalls", () => {
  const budget = new QualityBudget("high");
  feed(budget, 2, 60);
  expect(budget.tier).toBe("low");
});

it("renders manual High/Ultra more sharply while bounding native-DPI and 4K allocation", () => {
  const automatic = renderScale("high",390,844,3), high = renderScale("high",390,844,3,true), ultra = renderScale("ultra",390,844,3,true);
  expect(high).toBe(.5);expect(ultra).toBeCloseTo(1/3);
  expect((automatic/ultra)**2).toBeCloseTo(4);
  expect(renderScale("ultra",360,800,4,true)).toBe(.25);
  expect(renderScale("ultra",3840,2160,1,true)).toBe(1);
  expect(7680*4320/renderScale("ultra",7680,4320,4,true)**2).toBeLessThanOrEqual(8_500_001);
  expect(renderScale("high",390,844,3)).toBe(automatic);
  expect(Number.isFinite(renderScale("ultra",390,844,NaN,true))).toBe(true);
});

it("applies manual quality to a warmed engine immediately, keeps it under low FPS and cleans up on disposal", () => {
  vi.stubGlobal("navigator", {deviceMemory:2,hardwareConcurrency:4});
  vi.stubGlobal("window", {devicePixelRatio:3,removeEventListener:vi.fn()});vi.stubGlobal("document", {documentElement:{dataset:{}},removeEventListener:vi.fn()});
  let bounds={width:390,height:844};
  const canvas={getBoundingClientRect:()=>bounds} as unknown as HTMLCanvasElement;
  const engine=new NullEngine(), settings=new GraphicsSettings(()=>{throw Error("No storage");});
  const quality=new AdaptiveQuality(engine,canvas,settings), scale=vi.spyOn(engine,"setHardwareScalingLevel");
  try {
    expect(quality.tier).toBe("low");settings.set("ultra");
    expect(scale).toHaveBeenLastCalledWith(1/3);expect(getRenderQuality(engine)).toBe("ultra");
    for(let i=0;i<600;i++)quality.update(.1,true);
    expect(quality.tier).toBe("ultra");expect(scale).toHaveBeenCalledTimes(1);
    bounds={width:3840,height:2160};quality.resize();
    expect(scale).toHaveBeenLastCalledWith(renderScale("ultra",3840,2160,3,true));
    settings.set("medium");expect(quality.tier).toBe("medium");
    expect(document.documentElement.dataset).toMatchObject({quality:"medium",graphicsMode:"medium"});
    scale.mockClear();engine.dispose();settings.set("high");expect(scale).not.toHaveBeenCalled();
  } finally {if(!engine.isDisposed)engine.dispose();}
});

it("resumes automatic adaptation with a fresh budget after leaving a fixed preset", () => {
  vi.stubGlobal("navigator", {deviceMemory:8,hardwareConcurrency:8});
  vi.stubGlobal("window", {devicePixelRatio:3,removeEventListener:vi.fn()});vi.stubGlobal("document", {documentElement:{dataset:{}},removeEventListener:vi.fn()});
  const engine=new NullEngine(),settings=new GraphicsSettings(()=>{throw Error("No storage");});
  const quality=new AdaptiveQuality(engine,{getBoundingClientRect:()=>({width:390,height:844})} as HTMLCanvasElement,settings);
  const scale=vi.spyOn(engine,"setHardwareScalingLevel");
  try{
    expect(quality.tier).toBe("high");for(let i=0;i<360;i++)quality.update(1/30,true);
    expect(quality.tier).toBe("low");settings.set("high");
    for(let i=0;i<360;i++)quality.update(1/30,true);expect(quality.tier).toBe("high");
    expect(scale).toHaveBeenLastCalledWith(.5);
    settings.set("auto");expect(quality.tier).toBe("high");
    expect(scale).toHaveBeenLastCalledWith(2/3);
    for(let i=0;i<360;i++)quality.update(1/30,true);expect(quality.tier).toBe("low");
  } finally{engine.dispose();}
});
