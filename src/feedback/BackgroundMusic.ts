type MusicMedia = Pick<HTMLAudioElement, "play" | "pause" | "loop" | "volume">;

/** One persistent player across menus, runs and scene resets. */
export class BackgroundMusic {
  readonly #media: MusicMedia;
  #enabled = false;
  #unlocked = false;
  #visible = true;
  #requested = false;

  public constructor(media: MusicMedia) {
    this.#media = media;
    media.loop = true;
    media.volume = .32;
  }
  public setEnabled(enabled: boolean): void { this.#enabled = enabled; this.#apply(); }
  public setVisible(visible: boolean): void { this.#visible = visible; this.#apply(); }
  public unlock(): void { this.#unlocked = true; this.#apply(); }

  #apply(): void {
    if (!this.#enabled || !this.#unlocked || !this.#visible) {
      this.#requested = false;
      this.#media.pause();
      return;
    }
    if (this.#requested) return;
    this.#requested = true;
    void this.#media.play().catch(() => {
      // Browser autoplay policy can reject a gesture; retry on the next one.
      this.#requested = false;
    });
  }
}

export function initializeBackgroundMusic(): BackgroundMusic {
  const audio = document.createElement("audio");
  audio.dataset.audioChannel = "music";
  audio.preload = "none";
  audio.src = `${import.meta.env.BASE_URL}music-demo/sfb-freefall-30s.${audio.canPlayType("audio/ogg; codecs=vorbis") ? "ogg" : "mp3"}`;
  audio.hidden = true;
  document.body.append(audio);
  const music = new BackgroundMusic(audio);
  const unlock = (event: Event): void => { if (event.isTrusted) music.unlock(); };
  document.addEventListener("pointerdown", unlock, { passive: true });
  document.addEventListener("keydown", unlock);
  const visibility = (): void => { music.setVisible(!document.hidden); };
  document.addEventListener("visibilitychange", visibility);
  window.addEventListener("pagehide", () => { music.setVisible(false); });
  window.addEventListener("pageshow", visibility);
  visibility();
  return music;
}
