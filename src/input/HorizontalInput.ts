export interface HorizontalInput {
  readonly isActive: boolean;
  readonly normalizedPosition: number;
  /** Respond without acceleration easing; BallController still limits travel speed. */
  readonly isImmediate?: boolean;
}
interface PointerInputOptions {
  /** Current ball position in [-1,1], used as the origin of every new swipe. */
  readonly getPosition?: () => number;
  /** Unclamped screen-to-arena mapping, including the current camera zoom. */
  readonly mapPosition?: (screenPosition: number) => number;
  /** Live gain for relative touch/pen motion; absolute mouse targets stay precise. */
  readonly getSwipeSensitivity?: () => number;
  readonly onChange?: () => void;
}
const clamp = (value: number): number => Math.max(-1, Math.min(1, value));
export class PointerHorizontalInput implements HorizontalInput {
  readonly #canvas: HTMLCanvasElement;
  readonly #options: PointerInputOptions;
  readonly isImmediate = true;
  #activePointerId: number | null = null;
  #mouseActive = false;
  #normalizedPosition = 0;
  #lastClientX = 0;
  public constructor(canvas: HTMLCanvasElement, options: PointerInputOptions = {}) {
    this.#canvas = canvas; this.#options = options;
    canvas.addEventListener("pointerdown", this.#onPointerDown);
    canvas.addEventListener("pointermove", this.#onPointerMove);
    canvas.addEventListener("pointerrawupdate", this.#onPointerRawUpdate);
    canvas.addEventListener("pointerup", this.#onPointerEnd);
    canvas.addEventListener("pointercancel", this.#onPointerEnd);
    canvas.addEventListener("lostpointercapture", this.#onPointerEnd);
    canvas.addEventListener("pointerleave", this.#onPointerLeave);
    window.addEventListener("blur", this.#onBlur);
  }
  public get isActive(): boolean { return this.#activePointerId !== null || this.#mouseActive; }
  public get normalizedPosition(): number {
    if (this.#mouseActive) return clamp(this.#mapClientX(this.#lastClientX));
    return this.#normalizedPosition;
  }
  #mapClientX(clientX: number): number {
    const bounds = this.#canvas.getBoundingClientRect();
    const fraction = bounds.width > 0 ? (clientX - bounds.left) / bounds.width * 2 - 1 : 0;
    return this.#options.mapPosition?.(fraction) ?? fraction;
  }
  readonly #onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0 || this.#activePointerId !== null) return;
    if (event.pointerType === "mouse") {
      this.#mouseActive = true; this.#lastClientX = event.clientX;
    } else {
      this.#mouseActive = false; this.#activePointerId = event.pointerId;
      this.#lastClientX = event.clientX;
      this.#normalizedPosition = clamp(this.#options.getPosition?.() ?? this.#normalizedPosition);
      this.#canvas.setPointerCapture(event.pointerId);
    }
    this.#options.onChange?.();
  };
  readonly #onPointerMove = (event: PointerEvent): void => {
    const latest = typeof event.getCoalescedEvents === "function" ? event.getCoalescedEvents().at(-1) ?? event : event;
    if (event.pointerType === "mouse" && this.#activePointerId === null) {
      this.#mouseActive = true; this.#lastClientX = latest.clientX;
    } else if (event.pointerId === this.#activePointerId) {
      // Integrate displacement, not finger coordinates. Clamp each move so reversing
      // at an edge responds immediately instead of requiring the overshoot to be undone.
      const delta = this.#mapClientX(latest.clientX) - this.#mapClientX(this.#lastClientX);
      const sensitivity = this.#options.getSwipeSensitivity?.() ?? 1;
      this.#normalizedPosition = clamp(this.#normalizedPosition + delta * sensitivity);
      this.#lastClientX = latest.clientX;
    } else return;
    this.#options.onChange?.();
  };
  readonly #onPointerRawUpdate = (event: Event): void => {
    if (event instanceof PointerEvent) this.#onPointerMove(event);
  };
  readonly #onPointerEnd = (event: PointerEvent): void => {
    if (event.pointerId === this.#activePointerId) this.#activePointerId = null;
    if (event.pointerType === "mouse" && event.type === "pointercancel") this.#mouseActive = false;
  };
  readonly #onPointerLeave = (event: PointerEvent): void => {
    if (event.pointerType === "mouse") this.#mouseActive = false;
  };
  readonly #onBlur = (): void => { this.#activePointerId = null; this.#mouseActive = false; };
  public dispose(): void {
    this.#canvas.removeEventListener("pointerdown", this.#onPointerDown);
    this.#canvas.removeEventListener("pointermove", this.#onPointerMove);
    this.#canvas.removeEventListener("pointerrawupdate", this.#onPointerRawUpdate);
    this.#canvas.removeEventListener("pointerup", this.#onPointerEnd);
    this.#canvas.removeEventListener("pointercancel", this.#onPointerEnd);
    this.#canvas.removeEventListener("lostpointercapture", this.#onPointerEnd);
    this.#canvas.removeEventListener("pointerleave", this.#onPointerLeave);
    window.removeEventListener("blur", this.#onBlur);
    this.#onBlur();
  }
}
