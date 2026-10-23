interface DesktopActions {
  readonly active: () => boolean;
  readonly boost: () => void;
  readonly abilityDown: () => void;
  readonly abilityUp: () => void;
  readonly cancelAbility: () => void;
}
/** Global gameplay shortcuts never act through menus or text fields. */
export class DesktopGameControls {
  readonly #actions: DesktopActions;
  #spaceHeld = false;
  public constructor(actions: DesktopActions) {
    this.#actions = actions;
    document.addEventListener("pointerdown", this.#pointerDown);
    document.addEventListener("contextmenu", this.#contextMenu);
    document.addEventListener("keydown", this.#keyDown);
    document.addEventListener("keyup", this.#keyUp);
    window.addEventListener("blur", this.#cancel);
    document.addEventListener("visibilitychange", this.#cancel);
  }
  #allowed(target: EventTarget | null): boolean {
    return this.#actions.active() && document.querySelector("dialog[open]:not(#context-guide)") === null
      && !(target instanceof Element && target.closest("input,textarea,select,[contenteditable='true']"));
  }
  readonly #pointerDown = (event: PointerEvent): void => {
    if (event.pointerType !== "mouse" || event.button !== 2 || !this.#allowed(event.target)) return;
    event.preventDefault(); this.#actions.boost();
  };
  readonly #contextMenu = (event: Event): void => { if (this.#allowed(event.target)) event.preventDefault(); };
  readonly #keyDown = (event: KeyboardEvent): void => {
    if (event.code !== "Space" || !this.#allowed(event.target)) return;
    event.preventDefault();
    if (event.repeat || this.#spaceHeld) return;
    this.#spaceHeld = true; this.#actions.abilityDown();
  };
  readonly #keyUp = (event: KeyboardEvent): void => {
    if (event.code !== "Space" || !this.#spaceHeld) return;
    event.preventDefault(); this.#spaceHeld = false;
    if (this.#allowed(event.target)) this.#actions.abilityUp(); else this.#actions.cancelAbility();
  };
  readonly #cancel = (): void => { this.#spaceHeld = false; this.#actions.cancelAbility(); };
  public dispose(): void {
    this.#cancel();
    document.removeEventListener("pointerdown", this.#pointerDown);
    document.removeEventListener("contextmenu", this.#contextMenu);
    document.removeEventListener("keydown", this.#keyDown);
    document.removeEventListener("keyup", this.#keyUp);
    window.removeEventListener("blur", this.#cancel);
    document.removeEventListener("visibilitychange", this.#cancel);
  }
}
