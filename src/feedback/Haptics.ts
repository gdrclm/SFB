export const HAPTIC_PATTERNS = {
  weakBreak: { pattern: [10], priority: 60, interval: 60 },
  normalBreak: { pattern: [18], priority: 65, interval: 70 },
  heavyBreak: { pattern: [15, 25, 25], priority: 85, interval: 90 },
  powerfulBreak: { pattern: [12, 18, 18], priority: 75, interval: 90 },
  blockedImpact: { pattern: [50], priority: 90, interval: 120 },
  bounce: { pattern: [15], priority: 45, interval: 100 },
  boost: { pattern: [15, 25, 30], priority: 80, interval: 120 },
  boostUnavailable: { pattern: [5], priority: 15, interval: 250 },
  coin: { pattern: [6], priority: 10, interval: 450 },
  richChain: { pattern: [8, 35, 12], priority: 55, interval: 250 },
  slowOn: { pattern: [23], priority: 50, interval: 150 },
  slowOff: { pattern: [12], priority: 45, interval: 150 },
  heal: { pattern: [18, 40, 22], priority: 70, interval: 150 },
  lifeLost: { pattern: [65], priority: 100, interval: 150 },
  // Includes the life-loss impact and the final-life warning in one pattern.
  lastLife: { pattern: [65, 75, 35], priority: 105, interval: 300 },
  stage: { pattern: [12, 35, 12], priority: 55, interval: 300 },
  phase: { pattern: [18, 40, 25, 75, 35], priority: 95, interval: 1000 },
  record: { pattern: [12, 30, 18, 55, 25], priority: 70, interval: 1000 },
  menu: { pattern: [7], priority: 5, interval: 100 },
} as const;
export type HapticEvent = keyof typeof HAPTIC_PATTERNS;
export interface HapticDevice {
  vibrate(pattern: number | number[]): boolean;
  allowed(): boolean;
  now(): number;
}

export class Haptics {
  readonly #device: HapticDevice | null;
  readonly #lastPlayed = new Map<HapticEvent, number>();
  readonly #listeners = new Set<() => void>();
  #enabled = true;
  #available: boolean;
  #pending: HapticEvent | null = null;
  #timer: ReturnType<typeof setTimeout> | null = null;
  #busyUntil = 0;
  #activePriority = 0;

  public constructor(device: HapticDevice | null) { this.#device = device; this.#available = device !== null; }
  public get available(): boolean { return this.#available; }
  public subscribe(listener: () => void): () => void { this.#listeners.add(listener); return () => { this.#listeners.delete(listener); }; }
  public setEnabled(enabled: boolean): void { this.#enabled = enabled; if (!enabled) this.cancel(); }

  public request(event: HapticEvent): void {
    const device = this.#device;
    if (!this.#enabled || !this.#available || device === null || !device.allowed()) return;
    const definition = HAPTIC_PATTERNS[event];
    if (device.now() - (this.#lastPlayed.get(event) ?? -Infinity) < definition.interval) return;
    if (device.now() < this.#busyUntil && definition.priority <= this.#activePriority) return;
    if (this.#pending === null || definition.priority > HAPTIC_PATTERNS[this.#pending].priority) this.#pending = event;
    // One physical pattern for events from the same collision/frame.
    this.#timer ??= setTimeout(() => { this.#timer = null; this.#flush(); }, 20);
  }

  #flush(): void {
    const event = this.#pending; this.#pending = null;
    const device = this.#device;
    if (event === null || device === null || !this.#enabled || !this.#available || !device.allowed()) return;
    const definition = HAPTIC_PATTERNS[event];
    if (device.now() < this.#busyUntil && definition.priority <= this.#activePriority) return;
    try {
      if (!device.vibrate([...definition.pattern])) { this.#unavailable(); return; }
      this.#lastPlayed.set(event, device.now());
      this.#activePriority = definition.priority;
      this.#busyUntil = device.now() + definition.pattern.reduce<number>((sum, value) => sum + value, 0);
    } catch { this.#unavailable(); }
  }

  #unavailable(): void {
    this.#available = false;
    for (const listener of this.#listeners) listener();
  }

  public cancel(): void {
    if (this.#timer !== null) clearTimeout(this.#timer);
    this.#timer = null; this.#pending = null;
    if (this.#device !== null && this.#available && this.#busyUntil > this.#device.now()) {
      try { this.#device.vibrate(0); } catch { /* No actuator is required for gameplay. */ }
    }
    this.#busyUntil = 0; this.#activePriority = 0;
  }
}

let browserHaptics: Haptics | null = null;
export function getHaptics(): Haptics {
  if (browserHaptics !== null) return browserHaptics;
  let activated = false;
  const unlock = (event: Event): void => { if (event.isTrusted) activated = true; };
  document.addEventListener("pointerdown", unlock, true);
  document.addEventListener("keydown", unlock, true);
  const activation = (navigator as { readonly userActivation?: { readonly hasBeenActive: boolean } }).userActivation;
  const haptics = new Haptics(typeof navigator.vibrate !== "function" ? null : {
    vibrate: (pattern) => navigator.vibrate(pattern),
    allowed: () => document.visibilityState === "visible" && document.hasFocus() && (activated || activation?.hasBeenActive === true),
    now: () => performance.now(),
  });
  document.addEventListener("visibilitychange", () => { if (document.hidden) haptics.cancel(); });
  window.addEventListener("pagehide", () => { haptics.cancel(); });
  window.addEventListener("blur", () => { haptics.cancel(); });
  browserHaptics = haptics;
  return haptics;
}
