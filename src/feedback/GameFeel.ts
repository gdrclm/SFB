import { getRenderQuality } from "../rendering/AdaptiveQuality";
import { Matrix, Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Scene } from "@babylonjs/core/scene";
import { getGameSounds } from "./GameSounds";
import { breakFeedback, type BreakFeedback } from "../effects/BreakFeedback";
import type { BreakMaterial } from "./GameSounds";
import type { PlatformSurface } from "../platform/PlatformSurfaces";

export class GameFeel {
  readonly #scene: Scene;
  readonly #canvas: HTMLCanvasElement;
  readonly #root: HTMLElement;
  readonly #animations = new Map<Animation, HTMLElement | null>();
  readonly #reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  #paused = false;
  public constructor(scene: Scene, canvas: HTMLCanvasElement) {
    this.#scene = scene; this.#canvas = canvas;
    const root = document.querySelector<HTMLElement>("#impact-effects");
    if (root === null) throw new Error("Missing impact effects layer");
    this.#root = root; root.replaceChildren();
  }
  public screenPoint(position: { x: number; y: number; z: number }): { x: number; y: number } {
    const engine = this.#scene.getEngine(), camera = this.#scene.activeCamera;
    if (camera === null) return { x: 0, y: 0 };
    const w = engine.getRenderWidth(), h = engine.getRenderHeight();
    const point = Vector3.Project(new Vector3(position.x, position.y, position.z), Matrix.IdentityReadOnly,
      this.#scene.getTransformMatrix(), camera.viewport.toGlobal(w, h));
    const bounds = this.#canvas.getBoundingClientRect();
    return { x: point.x / w * bounds.width, y: point.y / h * bounds.height };
  }
  #animate(element: HTMLElement, frames: Keyframe[], duration: number, transient = true): void {
    if (this.#animations.size >= (getRenderQuality(this.#scene.getEngine()) === "low" ? 8 : 24)) { if (transient) element.remove(); return; }
    const animation = element.animate(frames, { duration, easing: "ease-out" });
    this.#animations.set(animation, transient ? element : null);
    animation.onfinish = () => { this.#animations.delete(animation); if (transient) element.remove(); };
    if (this.#paused) animation.pause();
  }
  #particle(position: { x: number; y: number }, kind: string, frames: Keyframe[], duration: number): void {
    if (this.#animations.size >= (getRenderQuality(this.#scene.getEngine()) === "low" ? 8 : 24)) return;
    const node = document.createElement("i"); node.className = `feel-${kind}`;
    node.style.left = `${String(position.x)}px`; node.style.top = `${String(position.y)}px`;
    this.#root.append(node); this.#animate(node, frames, duration);
  }
  public coin(position: { x: number; y: number; z: number }): void {
    getGameSounds().play("coin");
    const point = this.screenPoint(position), hud = document.querySelector<HTMLElement>(".coin-pill");
    const bounds = hud?.getBoundingClientRect();
    this.#particle(point, "coin", this.#reduced ? [{ opacity: 1 }, { opacity: 0 }] : [
      { transform: "translate(-50%, -50%) scale(1)", opacity: 1 },
      { transform: `translate(${String(((bounds?.x ?? 24) + 16 - point.x) * .4)}px, ${String(-50)}px) scale(1.1)`, opacity: 1, offset: .4 },
      { transform: `translate(${String((bounds?.x ?? 24) + 16 - point.x)}px, ${String((bounds?.y ?? 24) + 16 - point.y)}px) scale(.4)`, opacity: .7 },
    ], 320);
    if (hud !== null) this.#animate(hud, this.#reduced ? [{ borderColor: "#ffe66a" }, { borderColor: "#1ee4ff" }]
      : [{ transform: "scale(1.12)", borderColor: "#ffe66a", boxShadow: "0 0 15px #ffd12b, inset 0 0 8px #ffde7366" },
        { transform: "scale(1)", borderColor: "#1ee4ff", boxShadow: "0 0 8px #00baff88, inset 0 0 8px #008cff44" }], 320, false);
  }
  public magnetCoin(position: { x: number; y: number; z: number }, target: { x: number; y: number; z: number }): void {
    getGameSounds().play("coin");
    const from = this.screenPoint(position), to = this.screenPoint(target);
    this.#particle(from, "coin", [{ transform: "translate(-50%, -50%) scale(1.3)", opacity: 1 },
      { transform: `translate(${String(to.x - from.x)}px, ${String(to.y - from.y)}px) scale(.2)`, opacity: 0 }], this.#reduced ? 100 : 350);
  }
  public annihilation(position: { x: number; y: number; z: number }): void {
    getGameSounds().play("boost");
    this.#particle(this.screenPoint(position), "annihilation", [{ transform: "translate(-50%, -50%) scale(.2)", opacity: 1 },
      { transform: `translate(-50%, -50%) scale(${this.#reduced ? "1" : "18"})`, opacity: 0 }], 650);
  }
  public depth(): void {
    const panel = document.querySelector<HTMLElement>("#run-panel");
    if (panel !== null) this.#animate(panel, [{ borderColor: "#e9ffff", boxShadow: "0 0 18px #19dfff, inset 0 0 10px #27dcff99" },
      { borderColor: "#1ee4ff", boxShadow: "0 0 9px #00c8ff88, inset 0 2px 2px #b8f9ffbb" }], 300, false);
  }
  public heal(): void {
    getGameSounds().play("heal");
    const hearts = document.querySelector<HTMLElement>("#lives");
    if (hearts !== null) this.#animate(hearts, [{ filter: "drop-shadow(0 0 12px #9effa8)" }, { filter: "drop-shadow(0 0 0 transparent)" }], 450, false);
  }
  public flow(position: { x: number; y: number; z: number }): void {
    getGameSounds().play("zone-shatter");
    const speed = document.querySelector<HTMLElement>("#speed-panel");
    if (speed !== null) this.#animate(speed, this.#reduced
      ? [{ borderColor: "#eaffff" }, { borderColor: "#1ee4ff" }]
      : [{ transform: "scale(1.12)", filter: "drop-shadow(0 0 16px #77ffff)" }, { transform: "scale(1)", filter: "none" }], 480, false);
    this.#particle(this.screenPoint(position), "boost", this.#reduced
      ? [{ opacity: .5 }, { opacity: 0 }]
      : [{ transform: "translate(-50%, -50%) scale(.4)", opacity: .8 }, { transform: "translate(-50%, -50%) scale(7)", opacity: 0 }], 480);
  }
  public error(position: { x: number; y: number; z: number }): void {
    getGameSounds().play("impact");
    this.#particle(this.screenPoint(position), "danger", [{ transform: "translate(-50%, -50%) scale(.7)", opacity: .8 },
      { transform: `translate(-50%, -50%) scale(${this.#reduced ? "1" : "1.6"})`, opacity: 0 }], 300);
  }

  public boost(position: { x: number; y: number; z: number }): void {
    getGameSounds().play("boost");
    const speed = document.querySelector<HTMLElement>("#speed-panel");
    if (speed !== null) this.#animate(speed, [{ borderColor: "#e5ffff", boxShadow: "0 0 20px #12e5ff, inset 0 0 12px #30e9ff88" },
      { borderColor: "#1ee4ff", boxShadow: "0 0 8px #00baff88, inset 0 0 8px #008cff44" }], 350, false);
    const point = this.screenPoint(position);
    this.#particle(point, "boost", this.#reduced ? [{ opacity: .6 }, { opacity: 0 }] : [
      { transform: "translate(-50%, -50%) scale(.4)", opacity: .9 },
      { transform: "translate(-50%, -50%) scale(5)", opacity: 0 },
    ], 320);
    this.#animate(this.#root, [{ boxShadow: "inset 0 0 55px #68edff88" }, { boxShadow: "inset 0 0 0 transparent" }], 300, false);
  }
  public breakAt(position: { x: number; y: number; z: number }, heavy: boolean,speed=10,material:BreakMaterial="stone",power=false, feedback: BreakFeedback = breakFeedback(speed, 1, false),surface?:PlatformSurface): boolean {
    const sounds=getGameSounds();
    const audible=surface?sounds.playSurface(surface,speed,feedback.force*(heavy?1.1:1),power):sounds.playBreak(material,speed,feedback.force*(heavy?1.1:1),power);
    const point = this.screenPoint(position);
    this.#particle(point, "ring", [{ transform: "translate(-50%, -50%) scale(.3)", opacity: .8 },
      { transform: `translate(-50%, -50%) scale(${this.#reduced ? "1" : power?"4":heavy ? "3.5" : "2.5"})`, opacity: 0 }], 180);
    if (this.#reduced) return audible;
    const count = getRenderQuality(this.#scene.getEngine()) === "low" ? 2 : feedback.fragments;
    for (let i = 0; i < count; i++) {
      const angle = i * 2.4;
      this.#particle(point, material === "stone" ? "shard" : "spark", [{ opacity: 1, transform: `scale(${String(2.2 - feedback.power * .5)})` },
        { opacity: 0, transform: `translate(${String(Math.cos(angle) * feedback.spread)}px, ${String(Math.sin(angle) * feedback.spread * .6 - feedback.power * 55)}px) rotate(190deg) scale(.15)` }], 520 - feedback.power * 180);
    }
    return audible;
  }
  public setPaused(paused: boolean): void {
    if (this.#paused === paused) return;
    this.#paused = paused;
    if (paused) getGameSounds().stop();
    for (const animation of this.#animations.keys()) { if (paused) animation.pause(); else animation.play(); }
  }
  public dispose(): void {
    for (const animation of this.#animations.keys()) animation.cancel();
    this.#animations.clear(); this.#root.replaceChildren(); getGameSounds().stop();
  }
}
