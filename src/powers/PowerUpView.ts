import type { PowerKind, PowerUpController } from "./PowerUpController";
const FULL_HOLD_MS = 2000;
/** The left-hand slot supports taps and a deliberate, cancellable two-second hold. */
export class PowerUpView {
  readonly #button: HTMLButtonElement;
  readonly #powers: PowerUpController;
  readonly #kind: PowerKind;
  #holdTimer: ReturnType<typeof setTimeout> | null = null;
  #pressing = false;
  #pressStart = 0;
  #ignoreClick = false;
  #blocked = false;
  public constructor(button: HTMLButtonElement, powers: PowerUpController, kind: PowerKind) {
    this.#button = button; this.#powers = powers; this.#kind = kind;
    button.dataset.power = kind; button.classList.remove("slow-mode-active");
    const icon = button.querySelector(".slow-mode-value"), title = button.querySelector(".slow-mode-title");
    if (icon !== null) icon.textContent = kind === "plasma" ? "✺" : "◉";
    if (title !== null) title.textContent = kind === "plasma" ? "Плазменный разгон" : "Аннигиляция";
    button.addEventListener("click", this.#onClick);
    button.addEventListener("pointerdown", this.#onPointerDown);
    button.addEventListener("pointerup", this.#onPointerUp);
    button.addEventListener("pointermove", this.#onPointerMove);
    button.addEventListener("pointercancel", this.#cancelPress);
    button.addEventListener("lostpointercapture", this.#cancelPress);
    button.addEventListener("keydown", this.#onKeyDown);
    button.addEventListener("keyup", this.#onKeyUp);
    button.addEventListener("contextmenu", this.#onContextMenu);
    window.addEventListener("blur", this.#cancelPress);
    document.addEventListener("visibilitychange", this.#onVisibility);
    this.render(false);
  }
  #beginPress(): void {
    if (this.#pressing || this.#button.disabled) return;
    this.#ignoreClick = false; this.#pressing = true; this.#pressStart = performance.now();
    if (this.#powers.annihilationCharges !== 4) return;
    this.#button.dataset.holding = "true";
    this.#holdTimer = setTimeout(() => {
      if (this.#blocked || document.hidden || !document.hasFocus()) { this.#cancelPress(); return; }
      this.#ignoreClick = true; this.#powers.tryActivate("annihilation");
      this.#endPress(); this.render(this.#blocked);
    }, FULL_HOLD_MS);
  }
  #endPress(): void {
    if (this.#holdTimer !== null) clearTimeout(this.#holdTimer);
    this.#holdTimer = null; this.#pressing = false;
    delete this.#button.dataset.holding; this.#button.style.removeProperty("--hold-angle");
  }
  readonly #cancelPress = (): void => {
    if (!this.#pressing) return;
    this.#ignoreClick = true; this.#endPress();
  };
  readonly #onVisibility = (): void => { if (document.hidden) this.#cancelPress(); };
  readonly #onPointerDown = (event: PointerEvent): void => {
    if (this.#kind !== "annihilation" || event.button !== 0 || this.#button.disabled) return;
    this.#beginPress(); this.#button.setPointerCapture(event.pointerId);
  };
  readonly #onPointerUp = (): void => { this.#endPress(); };
  readonly #onPointerMove = (event: PointerEvent): void => {
    if (!this.#pressing) return;
    const bounds = this.#button.getBoundingClientRect();
    if (event.clientX < bounds.left - 16 || event.clientX > bounds.right + 16
      || event.clientY < bounds.top - 16 || event.clientY > bounds.bottom + 16) this.#cancelPress();
  };
  readonly #onClick = (): void => {
    if (this.#ignoreClick) { this.#ignoreClick = false; return; }
    if (this.#blocked) return;
    if (this.#pressing) this.#endPress();
    if (this.#kind === "annihilation") this.#powers.tryMiniAnnihilation();
    else this.#powers.tryActivate("plasma");
    this.render(this.#blocked);
  };
  readonly #onKeyDown = (event: KeyboardEvent): void => {
    if (this.#kind !== "annihilation" || event.code !== "Space") return;
    event.preventDefault(); if (!event.repeat) this.#beginPress();
  };
  readonly #onKeyUp = (event: KeyboardEvent): void => {
    if (this.#kind !== "annihilation" || event.code !== "Space") return;
    event.preventDefault();
    if (!this.#pressing) return;
    this.#endPress(); this.#onClick();
  };
  readonly #onContextMenu = (event: Event): void => { if (this.#kind === "annihilation") event.preventDefault(); };
  public render(blocked: boolean): void {
    this.#blocked = blocked;
    if (blocked) this.#cancelPress();
    const active = this.#kind === "plasma" && this.#powers.invulnerable;
    this.#button.disabled = blocked || !this.#powers.available(this.#kind);
    this.#button.setAttribute("aria-pressed", String(active));
    this.#button.dataset.active = String(active);
    this.#button.dataset.spent = String(!this.#powers.available(this.#kind) && !active);
    const charges = this.#powers.annihilationCharges;
    const hint = this.#kind === "plasma" ? "Плазменный разгон: одна активация, 30 секунд"
      : `Аннигиляция: ${String(charges)} из 4 зарядов. Нажми — очистить экран.${charges === 4 ? " Держи 2 секунды — радиус 200 метров за все заряды." : ""}`;
    this.#button.setAttribute("aria-label", hint); this.#button.title = hint;
    if (this.#pressing && charges === 4) this.#button.style.setProperty("--hold-angle", `${String(Math.min(360, (performance.now() - this.#pressStart) / FULL_HOLD_MS * 360))}deg`);
    const label = this.#button.querySelector(".slow-mode-state");
    if (label !== null) label.textContent = active ? `${String(Math.ceil(this.#powers.plasmaRemaining))} с`
      : this.#kind === "annihilation" ? `${String(charges)}/4` : this.#powers.available(this.#kind) ? "30 с" : "—";
  }
  public dispose(): void {
    this.#cancelPress();
    this.#button.removeEventListener("click", this.#onClick);
    this.#button.removeEventListener("pointerdown", this.#onPointerDown);
    this.#button.removeEventListener("pointerup", this.#onPointerUp);
    this.#button.removeEventListener("pointermove", this.#onPointerMove);
    this.#button.removeEventListener("pointercancel", this.#cancelPress);
    this.#button.removeEventListener("lostpointercapture", this.#cancelPress);
    this.#button.removeEventListener("keydown", this.#onKeyDown);
    this.#button.removeEventListener("keyup", this.#onKeyUp);
    this.#button.removeEventListener("contextmenu", this.#onContextMenu);
    window.removeEventListener("blur", this.#cancelPress);
    document.removeEventListener("visibilitychange", this.#onVisibility);
    delete this.#button.dataset.power; delete this.#button.dataset.active; delete this.#button.dataset.spent;
    this.#button.title = "";
    const icon = this.#button.querySelector(".slow-mode-value"), title = this.#button.querySelector(".slow-mode-title");
    if (icon !== null) icon.textContent = "◷";
    if (title !== null) title.textContent = "ЗАМЕДЛЕНИЕ";
  }
}
