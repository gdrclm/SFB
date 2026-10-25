type MusicMedia = Pick<HTMLAudioElement, "play" | "pause" | "loop" | "volume" | "currentTime">;
interface MusicTrack { media: MusicMedia; requested: boolean; playing: boolean; failed: boolean; generation: number }
export type SceneMusic = Pick<BackgroundMusic, "setCrystalBlend" | "setPaused">;

/** Two persistent players; the visual transition drives an equal-power crossfade. */
export class BackgroundMusic {
  readonly #tracks: MusicTrack[];
  #enabled = false;
  #unlocked = false;
  #visible = true;
  #paused = false;
  #targetBlend = 0;
  #blend = 0;

  public constructor(media: MusicMedia, crystal?: MusicMedia) {
    this.#tracks = [media, ...(crystal === undefined ? [] : [crystal])].map(audio => {
      audio.loop = true;
      return { media: audio, requested: false, playing: false, failed: false, generation: 0 };
    });
    this.#volumes();
  }
  public setEnabled(enabled: boolean): void { this.#enabled = enabled; this.#apply(); }
  public setVisible(visible: boolean): void { this.#visible = visible; this.#apply(); }
  public setPaused(paused: boolean): void {
    if (this.#paused === paused) return;
    this.#paused = paused; this.#apply();
  }
  public unlock(): void {
    this.#unlocked = true;
    for (const track of this.#tracks) track.failed = false;
    this.#apply();
  }
  public setCrystalBlend(blend: number): void {
    if (!Number.isFinite(blend)) return;
    const next = Math.max(0, Math.min(1, blend));
    if (next > 0 && this.#targetBlend === 0) {
      const crystal = this.#tracks[1];
      // The inaudible player is unlocked by the initial gesture. Enter at its intro.
      if (crystal !== undefined) crystal.media.currentTime = 0;
    }
    this.#targetBlend = next;
  }
  public update(seconds: number): void {
    if (!this.#canPlay() || !Number.isFinite(seconds) || seconds <= 0) return;
    const destination = this.#tracks[this.#targetBlend > this.#blend ? 1 : 0];
    // Keep the outgoing music until the incoming player's play() has succeeded.
    if (destination?.playing !== true) return;
    const step = Math.min(.1, seconds) / 2;
    this.#blend += Math.max(-step, Math.min(step, this.#targetBlend - this.#blend));
    this.#volumes();
  }

  #canPlay(): boolean { return this.#enabled && this.#unlocked && this.#visible && !this.#paused; }
  #volumes(): void {
    const blend = this.#tracks[1]?.playing === true ? this.#blend : 0;
    const sky = this.#tracks[0];
    if (sky !== undefined) sky.media.volume = .32 * Math.cos(blend * Math.PI / 2);
    if (this.#tracks[1] !== undefined) this.#tracks[1].media.volume = .32 * Math.sin(blend * Math.PI / 2);
  }

  #apply(): void {
    for (const track of this.#tracks) {
      if (!this.#canPlay()) {
        track.generation++;
        track.requested = false;
        track.playing = false;
        track.media.pause();
        continue;
      }
      if (track.requested || track.failed) continue;
      track.requested = true;
      const generation = ++track.generation;
      // Unlock both elements in the trusted gesture, including the silent track.
      void track.media.play().then(() => {
        if (generation !== track.generation) {
          if (!this.#canPlay()) track.media.pause();
          return;
        }
        track.playing = true;
        this.#volumes();
      }).catch(() => {
        if (generation !== track.generation) return;
        // Preserve the outgoing music and retry only on a subsequent gesture.
        track.requested = false; track.playing = false; track.failed = true;
        this.#volumes();
      });
    }
  }
}

export function initializeBackgroundMusic(): BackgroundMusic {
  let context: AudioContext | null = null;
  try { if (typeof AudioContext !== "undefined") context = new AudioContext(); }
  catch { /* Fall back to the media element on devices without Web Audio. */ }
  const createAudio = (name: string): MusicMedia => {
    const audio = document.createElement("audio");
    audio.dataset.audioChannel = "music";
    audio.preload = "auto";
    audio.src = `${import.meta.env.BASE_URL}music-demo/${name}.${audio.canPlayType("audio/ogg; codecs=vorbis") ? "ogg" : "mp3"}`;
    audio.hidden = true;
    document.body.append(audio);
    if (context === null) return audio;
    // iOS does not support programmatic HTMLMediaElement.volume. Mix via gains.
    const audioContext = context;
    const gain = audioContext.createGain();
    gain.gain.value = 0;
    audioContext.createMediaElementSource(audio).connect(gain);
    gain.connect(audioContext.destination);
    return {
      play: () => audio.play(), pause: () => { audio.pause(); },
      get loop() { return audio.loop; }, set loop(value: boolean) { audio.loop = value; },
      get currentTime() { return audio.currentTime; }, set currentTime(value: number) { audio.currentTime = value; },
      get volume() { return gain.gain.value; },
      set volume(value: number) { gain.gain.setTargetAtTime(value, audioContext.currentTime, .01); },
    };
  };
  const music = new BackgroundMusic(createAudio("sfb-freefall-30s"), createAudio("sfb-crystal-canyon-v2"));
  let previous = performance.now();
  const tick = (now: number): void => {
    music.update((now - previous) / 1000); previous = now;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  let unlocked = false;
  const resumeContext = (): void => {
    if (context?.state === "suspended") void context.resume().catch(() => {});
  };
  const unlock = (event: Event): void => {
    if (!event.isTrusted) return;
    unlocked = true; resumeContext(); music.unlock();
  };
  document.addEventListener("pointerdown", unlock, { passive: true });
  document.addEventListener("keydown", unlock);
  const visibility = (): void => {
    if (!document.hidden && unlocked) resumeContext();
    music.setVisible(!document.hidden);
  };
  document.addEventListener("visibilitychange", visibility);
  window.addEventListener("pagehide", () => { music.setVisible(false); });
  window.addEventListener("pageshow", visibility);
  visibility();
  return music;
}
