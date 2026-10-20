import { approachSymbol } from "./PlatformReadability";
import { Matrix, Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Scene } from "@babylonjs/core/scene";
import type { PlatformController } from "./PlatformController";

/** Neutral numbers remain legible when the speed-dependent camera zooms out. */
export class PlatformLabels {
  #visible: PlatformController[] = [];
  public get visiblePlatforms(): readonly PlatformController[] { return this.#visible; }
  readonly #scene: Scene;
  readonly #canvas: HTMLCanvasElement;
  readonly #labels: readonly { platform: PlatformController; label: HTMLSpanElement }[];

  public constructor(scene: Scene, canvas: HTMLCanvasElement, root: HTMLElement, platforms: readonly PlatformController[]) {
    this.#scene = scene;
    this.#canvas = canvas;
    root.replaceChildren();
    this.#labels = platforms.map((platform) => {
      const label = document.createElement("span");
      label.className = "platform-strength-label";
      label.hidden = true;
      root.append(label);
      return { platform, label };
    });
  }

  public render(): void {
    this.#visible = [];
    const camera = this.#scene.activeCamera;
    if (camera === null) return;
    const engine = this.#scene.getEngine();
    const width = engine.getRenderWidth();
    const height = engine.getRenderHeight();
    const viewport = camera.viewport.toGlobal(width, height);
    const bounds = this.#canvas.getBoundingClientRect();
    const transform = this.#scene.getTransformMatrix();
    for (const { platform, label } of this.#labels) {
      if (!platform.isActive) { label.hidden = true; continue; }
      const point = Vector3.Project(platform.mesh.getAbsolutePosition(), Matrix.IdentityReadOnly, transform, viewport);
      const visible = point.z >= 0 && point.z <= 1 && point.x >= 0 && point.x <= width && point.y >= 0 && point.y <= height;
      const numbers = document.body.dataset.platformNumbers === "true";
      label.hidden = !visible || !numbers && approachSymbol(platform.approachState) === "";
      if (!visible) continue;
      this.#visible.push(platform);
      const state = platform.approachState;
      label.textContent = numbers ? String(platform.strength) : approachSymbol(state);
      label.dataset.kind = platform.kind;
      label.style.left = `${String(point.x / width * bounds.width)}px`;
      label.style.top = `${String(point.y / height * bounds.height)}px`;
      label.dataset.approach = platform.approachState ?? "none";
    }
  }

  public dispose(): void { for (const { label } of this.#labels) label.remove(); }
}
