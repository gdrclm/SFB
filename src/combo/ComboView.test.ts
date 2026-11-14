import { afterEach, expect, it, vi } from "vitest";
import { ComboController } from "./ComboController";
import { ComboView } from "./ComboView";

class ElementStub {
  public dataset: Record<string, string> = {};
  public attributes: Record<string, string> = {};
  public textContent = "";
  public className = "";
  public setAttribute(key: string, value: string): void { this.attributes[key] = value; }
  public prepend(): void {}
  public remove(): void {}
}

afterEach(() => vi.unstubAllGlobals());

it("updates the hit count immediately, labels the points multiplier and stays visible between rows", () => {
  vi.stubGlobal("window", { matchMedia: () => ({ matches: true }) });
  vi.stubGlobal("document", { createElement: () => new ElementStub() });
  const panel = new ElementStub(), count = new ElementStub(), multiplier = new ElementStub();
  const elements = new Map([["#combo-count", count], ["#combo-multiplier", multiplier], [".combo-heading", new ElementStub()]]);
  const view = new ComboView(Object.assign(panel, { querySelector: (selector: string) => elements.get(selector) }) as unknown as HTMLElement);
  const combo = new ComboController();
  view.render(combo);
  expect(panel.dataset.visible).toBe("false");
  for (let hit = 1; hit <= 7; hit++) {
    view.hit(combo.hit(40, 20));
    // No render call: the collision itself must update the displayed number.
    expect(count.textContent).toBe(String(hit));
    view.fixedUpdate(2);
    expect(panel.dataset.visible).toBe("true");
    expect(panel.attributes["aria-hidden"]).toBe("false");
  }
  expect(multiplier.textContent).toBe("очки ×3");
  combo.miss(); view.miss();
  expect(panel.dataset.visible).toBe("false");
  view.hit(combo.hit(40, 20));
  expect(count.textContent).toBe("1");
  view.dispose();
  expect(panel.dataset.visible).toBe("false");
});
