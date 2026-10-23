import { afterEach, expect, it, vi } from "vitest";
import { ContextGuide } from "./ContextGuide";
class Node extends EventTarget {
  public dataset: Record<string, string> = {};
  public style: Record<string, string> = {};
  public hidden = false;
  public innerHTML = "";
  public textContent = "";
  public offsetHeight = 50;
  readonly attributes = new Set<string>();
  readonly children = new Map<string, Node>();
  public get open(): boolean { return this.attributes.has("open"); }
  public setAttribute(name: string): void { this.attributes.add(name); }
  public removeAttribute(name: string): void { this.attributes.delete(name); }
  public querySelector(selector: string): Node { let child = this.children.get(selector); if (!child) { child = new Node(); this.children.set(selector, child); } return child; }
  public getBoundingClientRect() { return { x: 0, y: 0, left: 0, right: 190, top: 0, bottom: 50, width: 190, height: 50 }; }
  public append(): void { /* Detached fake DOM. */ }
  public remove(): void { /* Detached fake DOM. */ }
}
function fixture() {
  const dialog = new Node(), document = new Node();
  Object.assign(document, { body: new Node(), createElementNS: () => new Node() });
  vi.stubGlobal("document", document); vi.stubGlobal("window", { innerWidth: 390, innerHeight: 844 });
  return { dialog, guide: new ContextGuide(dialog as unknown as HTMLDialogElement, vi.fn()) };
}
afterEach(() => vi.unstubAllGlobals());
it("starts fading the completed instruction immediately, then closes it and its arrow", () => {
  const { dialog, guide } = fixture();
  guide.show("coin"); expect(dialog.open).toBe(true);
  guide.completed("coin"); expect(guide.visible).toBe(false);
  expect(dialog.dataset.closing).toBe("true"); expect(dialog.open).toBe(true);
  guide.fixedUpdate(.1); expect(dialog.open).toBe(true);
  guide.fixedUpdate(.1); expect(dialog.open).toBe(false);
  guide.dispose();
});
it("does not let an old fade dismiss a new lesson or leave a replay hidden", () => {
  const { dialog, guide } = fixture();
  guide.show("coin"); guide.completed("coin"); guide.show("ability"); guide.fixedUpdate(.2);
  expect(dialog.open).toBe(true); expect(dialog.dataset.closing).toBeUndefined();
  guide.setPaused(true); guide.dispose();
  const replay = new ContextGuide(dialog as unknown as HTMLDialogElement, vi.fn());
  replay.show("platform"); expect(dialog.hidden).toBe(false); expect(dialog.open).toBe(true);
  replay.dispose();
});
