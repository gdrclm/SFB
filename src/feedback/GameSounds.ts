export type GameSound = "coin" | "boost" | "break" | "impact" | "heal";
const tones: Record<GameSound, readonly [number, number, number]> = {
  coin: [880, 1760, .09], heal: [520, 1040, .24], boost: [100, 650, .22], break: [160, 40, .1], impact: [90, 35, .18],
};
export function coinPitch(step: number): number {
  const semitones = [0, 2, 4, 7, 9, 12][Math.max(0, Math.min(5, Math.floor(step)))] ?? 0;
  return 2 ** (semitones / 12);
}

class GameSounds {
  #context: AudioContext | null = null;
  readonly #voices = new Set<AudioScheduledSourceNode>();
  #lastCoin = -Infinity;
  #coinStreak = 0;
  #noise: AudioBuffer | null = null;
  public constructor() {
    document.addEventListener("pointerdown", this.#unlock, true);
    document.addEventListener("keydown", this.#unlock, true);
    window.addEventListener("blur", () => { this.stop(); });
    document.addEventListener("visibilitychange", () => { if (document.hidden) this.stop(); });
    new MutationObserver(() => { if (document.documentElement.dataset.effectsEnabled === "false") this.stop(); })
      .observe(document.documentElement, { attributes: true, attributeFilter: ["data-effects-enabled"] });
  }
  readonly #unlock = (event: Event): void => {
    if (!event.isTrusted || typeof AudioContext === "undefined" || document.documentElement.dataset.effectsEnabled === "false") return;
    try {
      this.#context ??= new AudioContext();
      if (this.#context.state === "suspended") void this.#context.resume().catch(() => {});
    } catch { /* Sound is optional on browsers without an available audio device. */ }
  };
  public play(kind: GameSound, force = 1): void {
    const context = this.#context;
    if (context?.state !== "running" || document.hidden || !document.hasFocus() || document.documentElement.dataset.effectsEnabled === "false") return;
    const now = context.currentTime;
    if (kind === "coin" && now - this.#lastCoin < .08) return;
    if (kind === "coin") { this.#coinStreak = now - this.#lastCoin < .65 ? this.#coinStreak + 1 : 0; this.#lastCoin = now; }
    if (this.#voices.size >= 8) return;
    const [baseStart, baseEnd, duration] = tones[kind];
    const pitch = kind === "coin" ? coinPitch(this.#coinStreak) : 1;
    const weight = Math.max(.75, Math.min(1.6, force));
    const impactPitch = kind === "break" ? 1 / Math.sqrt(weight) : 1;
    const start = baseStart * pitch * impactPitch, end = baseEnd * pitch * impactPitch;
    const oscillator = context.createOscillator(), gain = context.createGain();
    oscillator.type = kind === "break" || kind === "impact" ? "triangle" : "sine";
    oscillator.frequency.setValueAtTime(start, now);
    oscillator.frequency.exponentialRampToValueAtTime(end, now + duration);
    gain.gain.setValueAtTime(.001, now);
    gain.gain.linearRampToValueAtTime(kind === "coin" ? .1 : .16 * weight, now + .008);
    gain.gain.exponentialRampToValueAtTime(.001, now + duration);
    oscillator.connect(gain); gain.connect(context.destination);
    this.#voices.add(oscillator);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); this.#voices.delete(oscillator); };
    oscillator.start(now); oscillator.stop(now + duration);
    if ((kind === "boost" || kind === "break" || kind === "impact") && this.#voices.size < 8) {
      if (this.#noise === null) {
        this.#noise = context.createBuffer(1, Math.ceil(context.sampleRate * .32), context.sampleRate);
        const data = this.#noise.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      }
      const source = context.createBufferSource(), filter = context.createBiquadFilter(), noiseGain = context.createGain();
      const length = kind === "boost" ? .20 : kind === "break" ? .1 : .12;
      source.buffer = this.#noise;
      filter.type = kind === "boost" ? "bandpass" : "lowpass";
      filter.frequency.setValueAtTime(kind === "boost" ? 500 : 2200, now);
      filter.frequency.exponentialRampToValueAtTime(kind === "boost" ? 4500 : 180, now + length);
      noiseGain.gain.setValueAtTime(.001, now);
      noiseGain.gain.linearRampToValueAtTime(.12, now + .008);
      noiseGain.gain.exponentialRampToValueAtTime(.001, now + length);
      source.connect(filter); filter.connect(noiseGain); noiseGain.connect(context.destination);
      this.#voices.add(source);
      source.onended = () => { source.disconnect(); filter.disconnect(); noiseGain.disconnect(); this.#voices.delete(source); };
      source.start(now, 0, length);
    }
  }
  public stop(): void {
    for (const voice of this.#voices) { try { voice.stop(); } catch { /* Already stopped. */ } }
    this.#voices.clear();
  }
}
let sounds: GameSounds | null = null;
export function getGameSounds(): GameSounds { return sounds ??= new GameSounds(); }
