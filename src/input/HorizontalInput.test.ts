import { afterEach, expect, it, vi } from "vitest";
import { PointerHorizontalInput } from "./HorizontalInput";
class TestPointer extends Event {
  readonly button = 0;
  public constructor(type: string, readonly clientX: number, readonly pointerType = "touch", readonly pointerId = 1) { super(type); }
}
class Canvas extends EventTarget {
  public getBoundingClientRect(): { left: number; width: number } { return { left: 0, width: 400 }; }
  public setPointerCapture(): void { /* Pointer capture is exercised in the real-browser check. */ }
}
afterEach(() => { vi.unstubAllGlobals(); });
function setup(position = 0, map: (x: number) => number = x => x, sensitivity: () => number = () => 1) {
  vi.stubGlobal("window", new EventTarget()); vi.stubGlobal("PointerEvent", TestPointer);
  const canvas = new Canvas();
  const input = new PointerHorizontalInput(canvas as unknown as HTMLCanvasElement, { getPosition: () => position, mapPosition: map, getSwipeSensitivity: sensitivity });
  const send = (type: string, x: number, pointerType = "touch", id = 1): void => { canvas.dispatchEvent(new TestPointer(type, x, pointerType, id)); };
  return { input, send };
}
it("starts a swipe at the ball, independent of where the finger touches the screen", () => {
  for (const origin of [20, 180, 320]) {
    const { input, send } = setup(.2);
    send("pointerdown", origin);
    expect(input.normalizedPosition).toBe(.2);
    send("pointermove", origin + 40);
    expect(input.normalizedPosition).toBeCloseTo(.4);
    input.dispose();
  }
});
it("uses camera scale for swipe displacement and reverses immediately after reaching an edge", () => {
  const { input, send } = setup(.5, x => x * 2);
  send("pointerdown", 50); send("pointermove", 100);
  expect(input.normalizedPosition).toBeCloseTo(1);
  send("pointermove", 180); expect(input.normalizedPosition).toBe(1);
  send("pointermove", 170); expect(input.normalizedPosition).toBeCloseTo(.9);
  input.dispose();
});
it("follows a mouse without holding a button, reprojects at zoom changes, and stops on leave", () => {
  let zoom = 1;
  const { input, send } = setup(0, x => x * zoom);
  send("pointermove", 300, "mouse");
  expect(input.isActive).toBe(true); expect(input.normalizedPosition).toBe(.5);
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
  send("pointermove", 140, "touch", 1); expect(input.normalizedPosition).toBeCloseTo(.2);
  send("pointercancel", 140, "touch", 1); expect(input.isActive).toBe(false);
  input.dispose();
});

it("increases swipe gain mid-gesture without jumping, and reverses immediately at an edge", () => {
  let sensitivity = 1;
  const { input, send } = setup(0, x => x, () => sensitivity);
  send("pointerdown", 100); send("pointermove", 140);
  expect(input.normalizedPosition).toBeCloseTo(.2);
  sensitivity = 3;
  expect(input.normalizedPosition).toBeCloseTo(.2);
  send("pointermove", 180);
  expect(input.normalizedPosition).toBeCloseTo(.8);
  send("pointermove", 250);
  expect(input.normalizedPosition).toBe(1);
  send("pointermove", 240);
  expect(input.normalizedPosition).toBeCloseTo(.85);
  sensitivity = 1;
  send("pointermove", 220);
  expect(input.normalizedPosition).toBeCloseTo(.75);
  input.dispose();
});

it("keeps the mouse target accurate regardless of swipe sensitivity", () => {
  const { input, send } = setup(0, x => x, () => 3);
  send("pointermove", 300, "mouse");
  expect(input.normalizedPosition).toBeCloseTo(.5);
  input.dispose();
});
