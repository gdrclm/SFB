export interface HorizontalInput {
  readonly isActive: boolean;
  readonly normalizedPosition: number;
}

export class PointerHorizontalInput implements HorizontalInput {
  readonly #canvas: HTMLCanvasElement;
  #activePointerId: number | null = null;
  #normalizedPosition = 0;

  public constructor(canvas: HTMLCanvasElement) {
    this.#canvas = canvas;
    canvas.addEventListener("pointerdown", this.#onPointerDown);
    canvas.addEventListener("pointermove", this.#onPointerMove);
    canvas.addEventListener("pointerrawupdate", this.#onPointerRawUpdate);
    canvas.addEventListener("pointerup", this.#onPointerEnd);
    canvas.addEventListener("pointercancel", this.#onPointerEnd);
    canvas.addEventListener("lostpointercapture", this.#onPointerEnd);
  }

  public get isActive(): boolean {
    return this.#activePointerId !== null;
  }

  public get normalizedPosition(): number {
    return this.#normalizedPosition;
  }

  public dispose(): void {
    this.#canvas.removeEventListener("pointerdown", this.#onPointerDown);
    this.#canvas.removeEventListener("pointermove", this.#onPointerMove);
    this.#canvas.removeEventListener(
      "pointerrawupdate",
      this.#onPointerRawUpdate,
    );
    this.#canvas.removeEventListener("pointerup", this.#onPointerEnd);
    this.#canvas.removeEventListener("pointercancel", this.#onPointerEnd);
    this.#canvas.removeEventListener("lostpointercapture", this.#onPointerEnd);
    this.#activePointerId = null;
  }

  readonly #onPointerDown = (event: PointerEvent): void => {
    if (this.#activePointerId !== null) {
      return;
    }

    this.#activePointerId = event.pointerId;
    this.#canvas.setPointerCapture(event.pointerId);
    this.#updateFromPointerEvent(event);
  };

  readonly #onPointerMove = (event: PointerEvent): void => {
    if (event.pointerId === this.#activePointerId) {
      this.#updateFromPointerEvent(event);
    }
  };

  readonly #onPointerRawUpdate = (event: Event): void => {
    if (event instanceof PointerEvent) {
      this.#onPointerMove(event);
    }
  };

  #updateFromPointerEvent(event: PointerEvent): void {
    const coalescedEvents =
      typeof event.getCoalescedEvents === "function"
        ? event.getCoalescedEvents()
        : [];
    const latestEvent = coalescedEvents.at(-1) ?? event;
    this.#updatePosition(latestEvent.clientX);
  }

  readonly #onPointerEnd = (event: PointerEvent): void => {
    if (event.pointerId === this.#activePointerId) {
      this.#activePointerId = null;
    }
  };

  #updatePosition(clientX: number): void {
    const bounds = this.#canvas.getBoundingClientRect();
    if (bounds.width <= 0) {
      return;
    }

    const position = ((clientX - bounds.left) / bounds.width) * 2 - 1;
    this.#normalizedPosition = Math.max(-1, Math.min(1, position));
  }
}
