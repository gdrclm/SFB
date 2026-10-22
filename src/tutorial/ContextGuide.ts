import type { GuideTip } from "./StagedOpening";
export interface HintPoint { x: number; y: number; }
const tips = {
  platform: { text: "Свайпай ↔", target: "world", seconds: 6 },
  coin: { text: "Собирай", target: "world", seconds: 5 },
  boost: { text: "Ускорься!", target: "#boost-button", seconds: 7 },
} as const;
type ActionTip = keyof typeof tips;

/** Never stops play or intercepts input. Real actions dismiss the corresponding arrow. */
export class ContextGuide {
  readonly #dialog: HTMLDialogElement;
  readonly #skip: () => void;
  readonly #arrow: SVGSVGElement;
  #tip: ActionTip | null = null;
  #remaining = 0;
  #anchor: (() => HintPoint | null) | undefined;
  #startX: number | null = null;
  public constructor(dialog: HTMLDialogElement, skip: () => void) {
    this.#dialog = dialog; this.#skip = skip;
    this.#arrow = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    this.#arrow.id = "guide-arrow"; this.#arrow.setAttribute("aria-hidden", "true");
    this.#arrow.innerHTML = '<defs><marker id="guide-arrow-head" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0 0L8 4L0 8" fill="none" stroke="#e9ffff" stroke-width="2"/></marker></defs><path class="guide-line" fill="none" stroke="#e9ffff" stroke-width="4" marker-end="url(#guide-arrow-head)"/>';
    this.#arrow.style.display = "none"; document.body.append(this.#arrow);
    dialog.querySelector("#context-skip")?.addEventListener("click", this.#skipAll);
    document.addEventListener("pointerdown", this.#touch, true);
    document.addEventListener("pointermove", this.#move, true);
    document.addEventListener("pointerup", this.#release, true);
  }
  public show(tip: GuideTip, anchor?: () => HintPoint | null): void {
    if (!(tip in tips)) return;
    const action = tip as ActionTip, data = tips[action];
    this.#tip = action; this.#remaining = data.seconds; this.#anchor = anchor;
    this.#dialog.dataset.tip = tip;
    const text = this.#dialog.querySelector("#context-text");
    if (text === null) throw new Error("Missing hint text");
    text.textContent = data.text;
    if (!this.#dialog.open) this.#dialog.setAttribute("open", "");
    this.#arrow.style.display = "block"; this.layout();
  }
  public completed(tip: ActionTip): void { if (this.#tip === tip) this.#close(); }
  public fixedUpdate(realDeltaSeconds: number): void {
    if (this.#tip === null) return;
    this.#remaining -= realDeltaSeconds;
    if (this.#remaining <= 0) this.#close();
  }
  public layout(): void {
    if (this.#tip === null) return;
    const width = window.innerWidth, height = window.innerHeight, data = tips[this.#tip];
    const target = data.target === "world" ? null : document.querySelector(data.target)?.getBoundingClientRect();
    const point = this.#anchor?.() ?? (target ? { x: target.x + target.width / 2, y: target.y } : { x: width / 2, y: height * .52 });
    const x = Math.max(20, Math.min(width - 20, point.x)), y = Math.max(70, Math.min(height - 30, point.y));
    const boxWidth = Math.min(190, width - 24);
    this.#dialog.style.width = `${String(boxWidth)}px`;
    this.#dialog.style.left = `${String(Math.max(12, Math.min(width - boxWidth - 12, x - boxWidth / 2)))}px`;
    this.#dialog.style.top = `${String(Math.max(85, y - this.#dialog.offsetHeight - 48))}px`;
    const box = this.#dialog.getBoundingClientRect(), startX = Math.max(box.left + 20, Math.min(box.right - 20, x));
    this.#arrow.setAttribute("viewBox", `0 0 ${String(width)} ${String(height)}`);
    this.#arrow.querySelector(".guide-line")?.setAttribute("d", `M${String(startX)} ${String(box.bottom + 4)} Q${String(startX + 18)} ${String((box.bottom + y) / 2)} ${String(x)} ${String(y - 7)}`);
  }
  readonly #touch = (event: PointerEvent): void => { if (event.target instanceof Element && event.target.closest("#game-canvas")) this.#startX = event.clientX; };
  readonly #move = (event: PointerEvent): void => { if (this.#startX !== null && Math.abs(event.clientX - this.#startX) >= 12) this.completed("platform"); };
  readonly #release = (): void => { this.#startX = null; };
  readonly #skipAll = (): void => { this.#close(); this.#skip(); };
  #close(): void { this.#tip = null; this.#dialog.removeAttribute("open"); this.#arrow.style.display = "none"; }
  public dispose(): void {
    this.#close(); this.#arrow.remove();
    document.removeEventListener("pointerdown", this.#touch, true);
    document.removeEventListener("pointermove", this.#move, true);
    document.removeEventListener("pointerup", this.#release, true);
    this.#dialog.querySelector("#context-skip")?.removeEventListener("click", this.#skipAll);
  }
}
