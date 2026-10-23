import type { PlatformEncounterTheme } from "../platform/PlatformRoutePlanner";
import type { PlatformController } from "../platform/PlatformController";

export type EncounterMood = "neutral" | "trap" | "danger" | "reward" | "shatter";
export function encounterMood(theme: PlatformEncounterTheme): EncounterMood {
  if (theme === "rich-lane") return "reward";
  if (theme === "break-run") return "shatter";
  if (theme === "trap" || theme === "deception" || theme === "bait") return "trap";
  if (theme === "danger-lane" || theme === "death-tunnel") return "danger";
  return "neutral";
}

/** Visual atmosphere describes the approaching encounter, never which lane is safe. */
export class EncounterFeedback {
  readonly #root = document.createElement("div");
  readonly #symbols: HTMLElement[] = [];
  readonly #onEntry: (mood: EncounterMood) => void;
  #mood: EncounterMood = "neutral";
  #time = 0;
  #lastEntry = -10;

  public constructor(parent: HTMLElement, onEntry: (mood: EncounterMood) => void) {
    this.#onEntry = onEntry;
    this.#root.className = "encounter-feedback";
    this.#root.setAttribute("aria-hidden", "true"); this.#root.hidden = true;
    for (const side of ["left", "right"]) {
      const rail = document.createElement("div"); rail.className = `encounter-rail encounter-${side}`;
      for (let i = 0; i < 3; i++) {
        const symbol = document.createElement("i"); symbol.style.setProperty("--mark", String(i));
        rail.append(symbol); this.#symbols.push(symbol);
      }
      this.#root.append(rail);
    }
    parent.append(this.#root);
  }

  public render(platforms: readonly PlatformController[], ballY: number, frozen: boolean, seconds: number): void {
    if (!frozen) this.#time += Math.max(0, seconds);
    let nearest: PlatformController | undefined;
    for (const platform of platforms) if (platform.isActive && platform.mesh.position.y < ballY &&
      (!nearest || platform.mesh.position.y > nearest.mesh.position.y)) nearest = platform;
    const mood = encounterMood(nearest?.encounterTheme ?? "chaos");
    if (mood !== this.#mood && !frozen) {
      this.#mood = mood;
      this.#root.dataset.zone = mood;
      const symbol = mood === "reward" ? "✦" : mood === "shatter" ? "◇" : "⌃";
      for (const mark of this.#symbols) mark.textContent = symbol;
      if (mood !== "neutral" && this.#time - this.#lastEntry > 1) {
        this.#lastEntry = this.#time; this.#onEntry(mood);
      }
    }
    this.#root.hidden = frozen || this.#mood === "neutral";
  }

  public dispose(): void { this.#root.remove(); }
}
