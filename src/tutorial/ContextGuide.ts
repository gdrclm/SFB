import { guideHint, tutorialInput, type TutorialInput } from "./GuideHints";
import { tutorialVisuals } from "../app/TutorialController";
import type { GuideTip } from "./StagedOpening";
export interface HintPoint { x: number; y: number; }
/** Never stops play or intercepts input. Real actions dismiss the corresponding arrow. */
export class ContextGuide {
  readonly #dialog: HTMLDialogElement;
  readonly #skip: () => void;
  readonly #arrow: SVGSVGElement;
  #tip: GuideTip | null = null;
  #remaining = 0;
  #anchor: (() => HintPoint | null) | undefined;
  #startX: number | null = null;
  #input: TutorialInput = tutorialInput();
  #paused = false;
  #closing = 0;
  public constructor(dialog: HTMLDialogElement, skip: () => void) {
    this.#dialog = dialog; this.#skip = skip;
    dialog.hidden = false; dialog.removeAttribute("open"); delete dialog.dataset.closing;
    this.#arrow = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    this.#arrow.id = "guide-arrow"; this.#arrow.setAttribute("aria-hidden", "true");
    this.#arrow.innerHTML = '<defs><marker id="guide-arrow-head" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0 0L8 4L0 8" fill="none" stroke="#e9ffff" stroke-width="2"/></marker></defs><path class="guide-line" fill="none" stroke="#e9ffff" stroke-width="4" marker-end="url(#guide-arrow-head)"/>';
    this.#arrow.style.display = "none"; document.body.append(this.#arrow);
    dialog.querySelector("#context-skip")?.addEventListener("click", this.#skipAll);
    document.addEventListener("pointerdown", this.#touch, true);
    document.addEventListener("pointermove", this.#move, true);
    document.addEventListener("pointerup", this.#release, true);
  }
  public get visible(): boolean { return this.#tip !== null; }
  public show(tip: GuideTip, anchor?: () => HintPoint | null): void {
    const data = guideHint(tip, this.#input);
    if (!data) return;
    this.#closing = 0; delete this.#dialog.dataset.closing; delete this.#arrow.dataset.closing;
    this.#tip = tip; this.#remaining = data.seconds; this.#anchor = anchor;
    this.#dialog.dataset.tip = tip;
    const text = this.#dialog.querySelector("#context-text");
    if (text === null) throw new Error("Missing hint text");
    text.textContent = data.text;
    const picture = this.#dialog.querySelector("#context-picture");
    if (picture) picture.innerHTML = tip === "fork" || tip === "super-heavy" ? tutorialVisuals.platform("super-heavy", 25)
      : tip === "vitality" ? tutorialVisuals.platform("vitality", 7) + tutorialVisuals.heart
      : tip === "time-slow" ? tutorialVisuals.platform("time-slow", 7)
      : tip === "ability" ? tutorialVisuals.slow
      : tip === "abilities" ? '<span class="tutorial-icon" aria-hidden="true">◉ ✺</span>'
      : tip === "life" ? tutorialVisuals.heart : tip === "coin" ? tutorialVisuals.coin
      : tip === "annihilation" ? '<span class="tutorial-icon" aria-hidden="true">◉</span>' : "";
    if (!this.#dialog.open) this.#dialog.setAttribute("open", "");
    this.#arrow.style.display = "block"; this.layout();
  }
  public completed(tip: GuideTip): void { if (this.#tip === tip) this.#close(); }
  public setPaused(paused: boolean): void {
    this.#paused = paused; this.#dialog.hidden = paused;
    this.#arrow.style.display = paused || this.#tip === null && this.#closing === 0 ? "none" : "block";
  }
  public fixedUpdate(realDeltaSeconds: number): void {
    if (this.#paused) return;
    if (this.#closing > 0) {
      this.#closing = Math.max(0, this.#closing - realDeltaSeconds);
      if (this.#closing === 0) this.#hide();
      return;
    }
    if (this.#tip === null) return;
    this.#remaining -= realDeltaSeconds;
    if (this.#remaining <= 0) this.#close();
  }
  public layout(): void {
    if (this.#tip === null || this.#paused) return;
    const width = window.innerWidth, height = window.innerHeight, data = guideHint(this.#tip, this.#input);
    if (!data) return;
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
  readonly #move = (event: PointerEvent): void => {
    if (!(event.target instanceof Element) || !event.target.closest("#game-canvas")) return;
    const input = event.pointerType === "mouse" ? "desktop" : "touch";
    if (input !== this.#input) {
      this.#input = input;
      const data = this.#tip === null ? null : guideHint(this.#tip, input);
      const text = this.#dialog.querySelector("#context-text");
      if (data && text) text.textContent = data.text;
    }
    if (input === "desktop" && Math.abs(event.movementX) > 0) this.completed("platform");
    if (input === "desktop" && this.#startX === null) this.#startX = event.clientX;
    if (this.#startX !== null && Math.abs(event.clientX - this.#startX) >= 12) this.completed("platform");
  };
  readonly #release = (): void => { this.#startX = null; };
  readonly #skipAll = (): void => { this.#close(); this.#skip(); };
  #close(): void {
    if (this.#tip === null) return;
    this.#tip = null; this.#closing = .18;
    this.#dialog.dataset.closing = "true"; this.#arrow.dataset.closing = "true";
  }
  #hide(): void {
    this.#tip = null; this.#closing = 0; this.#dialog.removeAttribute("open");
    delete this.#dialog.dataset.closing; delete this.#arrow.dataset.closing; this.#arrow.style.display = "none";
  }
  public dispose(): void {
    this.#hide(); this.#arrow.remove();
    document.removeEventListener("pointerdown", this.#touch, true);
    document.removeEventListener("pointermove", this.#move, true);
    document.removeEventListener("pointerup", this.#release, true);
    this.#dialog.querySelector("#context-skip")?.removeEventListener("click", this.#skipAll);
  }
}
