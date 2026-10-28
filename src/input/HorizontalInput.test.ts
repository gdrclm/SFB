import { afterEach, expect, it, vi } from "vitest";
import { PointerHorizontalInput } from "./HorizontalInput";
class TestPointer extends Event {
  readonly button = 0;
  public constructor(type: string, readonly clientX: number, readonly pointerType = "touch", readonly pointerId = 1, time = 0) {
    super(type); Object.defineProperty(this, "timeStamp", { value: time });
  }
}
class Canvas extends EventTarget {
  public getBoundingClientRect(): { left: number; width: number } { return { left: 0, width: 400 }; }
  public setPointerCapture(): void { /* EventTarget fixture does not emulate browser capture. */ }
}
afterEach(() => { vi.unstubAllGlobals(); });
function setup(position: number | (() => number) = 0, map: (x: number) => number = x => x) {
  vi.stubGlobal("window", new EventTarget()); vi.stubGlobal("PointerEvent", TestPointer);
  const canvas = new Canvas(); let time = 0;
  const input = new PointerHorizontalInput(canvas as unknown as HTMLCanvasElement, { getPosition: () => typeof position === "function" ? position() : position, mapPosition: map, now: () => time });
  const send = (type: string, x: number, pointerType = "touch", id = 1, elapsed = 200): void => {
    time += elapsed; canvas.dispatchEvent(new TestPointer(type, x, pointerType, id, time));
  };
  return { input, send, canvas, idle: (ms: number) => { time += ms; } };
}
it("starts a swipe at the ball, independent of where the finger touches the screen", () => {
  for (const origin of [20, 180, 320]) {
    const { input, send } = setup(.2);
    send("pointerdown", origin); expect(input.normalizedPosition).toBe(.2);
    send("pointermove", origin + 40); expect(input.normalizedPosition).toBeCloseTo(.35);
    input.dispose();
  }
});
it("uses camera scale and reverses immediately at an edge, even after a forceful flick", () => {
  let position = .5;
  const { input, send } = setup(() => position, x => x * 2);
  send("pointerdown", 50); send("pointermove", 180, "touch", 1, 30);
  expect(input.normalizedPosition).toBe(1);
  position = 1;
  send("pointermove", 170, "touch", 1, 100);
  expect(input.normalizedPosition).toBeCloseTo(.925);
  expect(input.steeringEffort).toBe(0);
  input.dispose();
});
it("cancels a distant pending flick target when the player makes a small reverse correction", () => {
  let position = 0;
  const { input, send } = setup(() => position);
  send("pointerdown",100); send("pointermove",200,"touch",1,30);
  expect(input.normalizedPosition).toBe(1);
  position = .2;
  send("pointermove",196,"touch",1,20);
  expect(input.normalizedPosition).toBeLessThan(position);
  expect(input.normalizedPosition).toBeGreaterThan(.18);
  input.dispose();
});
it("follows a mouse without holding a button, reprojects at zoom changes, and stops on leave", () => {
  let zoom = 1;
  const { input, send } = setup(0, x => x * zoom);
  send("pointermove", 300, "mouse");
  expect(input.isActive).toBe(true); expect(input.normalizedPosition).toBe(.5);
  expect(input.steeringEffort).toBeUndefined();
  send("pointerup", 300, "mouse"); expect(input.isActive).toBe(true);
  zoom = 1.5; expect(input.normalizedPosition).toBe(.75);
  send("pointerleave", 300, "mouse"); expect(input.isActive).toBe(false);
  input.dispose(); send("pointermove", 20, "mouse"); expect(input.isActive).toBe(false);
});
it("ignores a second touch so steering can coexist with a held ability button", () => {
  const { input, send } = setup();
  send("pointerdown", 100, "touch", 1);
  send("pointerdown", 350, "touch", 2); send("pointermove", 380, "touch", 2);
  expect(input.normalizedPosition).toBe(0);
  send("pointermove", 140, "touch", 1); expect(input.normalizedPosition).toBeCloseTo(.15);
  send("pointercancel", 140, "touch", 1); expect(input.isActive).toBe(false);
  input.dispose();
});
it("boosts a broad fast swipe while a broad slow swipe or a fast tiny correction stays gentle", () => {
  const drag = (distance: number, duration: number) => {
    const f = setup(); f.send("pointerdown", 100);
    f.send("pointermove", 100 + distance, "touch", 1, duration);
    const result = { target: f.input.normalizedPosition, effort: f.input.steeringEffort ?? 0 };
    f.input.dispose(); return result;
  };
  expect(drag(100, 40).target).toBeCloseTo(1);
  expect(drag(100, 40).effort).toBe(1);
  expect(drag(100, 1000).target).toBeCloseTo(.375);
  expect(drag(2, 8).effort).toBe(0);
});
it("expires flick strength when held still, leaves the target stable and resets on a fresh gesture", () => {
  const { input, send, idle } = setup();
  send("pointerdown", 100); send("pointermove", 160, "touch", 1, 20);
  expect(input.steeringEffort).toBeGreaterThan(.9);
  const target = input.normalizedPosition;
  idle(250); expect(input.steeringEffort).toBe(0); expect(input.normalizedPosition).toBe(target);
  send("pointerup", 160); send("pointerdown", 300);
  expect(input.steeringEffort).toBe(0); expect(input.normalizedPosition).toBe(0);
  input.dispose();
});
it("ignores duplicated raw samples and processes coalesced movement in timestamp order", () => {
  const { input, send, canvas } = setup(); send("pointerdown", 100);
  const event = new TestPointer("pointerrawupdate", 180, "touch", 1, 240);
  Object.assign(event, { getCoalescedEvents: () => [new TestPointer("pointermove", 140, "touch", 1, 220), new TestPointer("pointermove", 180, "touch", 1, 240)] });
  canvas.dispatchEvent(event); const target = input.normalizedPosition;
  canvas.dispatchEvent(event); expect(input.normalizedPosition).toBe(target);
  input.dispose();
});
