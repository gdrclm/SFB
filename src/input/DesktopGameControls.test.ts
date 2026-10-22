import { afterEach, expect, it, vi } from "vitest";
import { DesktopGameControls } from "./DesktopGameControls";
class Target extends EventTarget { public querySelector(): null { return null; } }
class TestElement extends EventTarget { public closest(): null { return null; } }
class Key extends Event {
  public constructor(type: string, readonly code = "Space", readonly repeat = false) { super(type, { cancelable: true }); }
}
afterEach(() => { vi.unstubAllGlobals(); });
function setup() {
  const doc = new Target(), win = new EventTarget();
  vi.stubGlobal("document", doc); vi.stubGlobal("window", win); vi.stubGlobal("Element", TestElement);
  let active = true;
  const actions = { active: () => active, boost: vi.fn(), abilityDown: vi.fn(), abilityUp: vi.fn(), cancelAbility: vi.fn() };
  const controls = new DesktopGameControls(actions);
  return { doc, win, actions, controls, pause: () => { active = false; } };
}
it("uses right mouse once, suppresses its context menu and never acts while paused", () => {
  const { doc, actions, controls, pause } = setup();
  const pointer = (): Event => Object.assign(new Event("pointerdown", { cancelable: true }), { pointerType: "mouse", button: 2 });
  expect(doc.dispatchEvent(pointer())).toBe(false); expect(actions.boost).toHaveBeenCalledTimes(1);
  expect(doc.dispatchEvent(new Event("contextmenu", { cancelable: true }))).toBe(false);
  pause(); doc.dispatchEvent(pointer()); expect(actions.boost).toHaveBeenCalledTimes(1);
  controls.dispose();
});
it("ignores space repeats, releases once and cancels a hold on blur or pause", () => {
  const { doc, win, actions, controls, pause } = setup();
  doc.dispatchEvent(new Key("keydown")); doc.dispatchEvent(new Key("keydown", "Space", true));
  expect(actions.abilityDown).toHaveBeenCalledTimes(1);
  doc.dispatchEvent(new Key("keyup")); expect(actions.abilityUp).toHaveBeenCalledTimes(1);
  doc.dispatchEvent(new Key("keydown")); win.dispatchEvent(new Event("blur")); doc.dispatchEvent(new Key("keyup"));
  expect(actions.abilityUp).toHaveBeenCalledTimes(1); expect(actions.cancelAbility).toHaveBeenCalledTimes(1);
  doc.dispatchEvent(new Key("keydown")); pause(); doc.dispatchEvent(new Key("keyup"));
  expect(actions.cancelAbility).toHaveBeenCalledTimes(2);
  controls.dispose(); doc.dispatchEvent(new Key("keydown")); expect(actions.abilityDown).toHaveBeenCalledTimes(3);
});
