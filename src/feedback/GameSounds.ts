export type GameSound = "coin" | "boost" | "break" | "impact" | "heal" | "zone-trap" | "zone-reward" | "zone-shatter";
export type BreakMaterial="stone"|"bubble"|"cloud";
export function breakSoundProfile(material:BreakMaterial,speed:number,power=false){
 const energy=Math.max(0,Math.min(1,(speed-10)/100));
 return{duration:(.19-energy*.095)*(power?.82:1),gain:(.75+energy*.40)*(power?1.12:1),
  thump:material==="stone"?105:material==="bubble"?155:72,
  crack:material==="stone"?2400:material==="bubble"?680:1100,
  whistle:700+energy*1100+(power?350:0)};
}
const tones: Record<GameSound, readonly [number, number, number]> = {
  "zone-trap": [240, 95, .3], "zone-reward": [620, 1240, .3], "zone-shatter": [330, 660, .18],
  coin: [880, 1760, .09], heal: [520, 1040, .24], boost: [100, 650, .22], break: [160, 40, .1], impact: [90, 35, .18],
};
export function coinPitch(step: number): number {
  const semitones = [0, 2, 4, 7, 9, 12][Math.max(0, Math.min(5, Math.floor(step)))] ?? 0;
  return 2 ** (semitones / 12);
}

export function speedSoundProfile(speed: number): { frequency: number; gain: number } {
  const safe = Number.isFinite(speed) ? Math.max(0, speed) : 0;
  const power = Math.max(0, Math.min(1, Math.log2(Math.max(1, safe / 14)) / 4));
  return { frequency: 46 + power * 42, gain: .035 * power * power };
}

export function whistleSoundProfile(speed: number): { frequency: number; gain: number } {
  const power = Number.isFinite(speed) ? Math.max(0, Math.min(1, Math.log2(Math.max(1, speed / 70)) / 2.5)) : 0;
  return { frequency: 950 + power * 850, gain: .018 * power };
}

export class GameSounds {
  #context: AudioContext | null = null;
  readonly #voices = new Set<AudioScheduledSourceNode>();
  #lastCoin = -Infinity;
  #coinStreak = 0;
  #noise: AudioBuffer | null = null;
  #speedVoice: { oscillator: OscillatorNode; gain: GainNode } | null = null;
  #whistleVoice: { oscillator: OscillatorNode; gain: GainNode } | null = null;
  #lastRiser = -Infinity;
  #bus:DynamicsCompressorNode|null=null;
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
      if(this.#bus===null){this.#bus=this.#context.createDynamicsCompressor();this.#bus.threshold.value=-10;this.#bus.knee.value=8;this.#bus.ratio.value=6;this.#bus.attack.value=.003;this.#bus.release.value=.09;this.#bus.connect(this.#context.destination);}
      if (this.#context.state === "suspended") void this.#context.resume().catch(() => {});
    } catch { /* Sound is optional on browsers without an available audio device. */ }
  };

  /** One reusable bass oscillator, independent of the music switch and bounded transient voices. */
  public updateSpeed(speed: number, active: boolean): void {
    const context = this.#context;
    const profile = speedSoundProfile(speed);
    if (!active || context?.state !== "running" || document.hidden || !document.hasFocus()
      || document.documentElement.dataset.effectsEnabled === "false" || profile.gain === 0) {
      this.#stopSpeed(); return;
    }
    if (this.#speedVoice === null) {
      const oscillator = context.createOscillator(), gain = context.createGain();
      oscillator.type = "triangle";
      oscillator.frequency.setValueAtTime(profile.frequency, context.currentTime);
      gain.gain.setValueAtTime(0, context.currentTime);
      oscillator.connect(gain); gain.connect(this.#bus ?? context.destination);
      this.#speedVoice = { oscillator, gain };
      oscillator.start();
    }
    this.#speedVoice.oscillator.frequency.setTargetAtTime(profile.frequency, context.currentTime, .08);
    this.#speedVoice.gain.gain.setTargetAtTime(profile.gain, context.currentTime, .08);
    const whistle = whistleSoundProfile(speed);
    if (whistle.gain === 0) { this.#stopWhistle(); return; }
    if (this.#whistleVoice === null) {
      const oscillator = context.createOscillator(), gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(whistle.frequency, context.currentTime);
      gain.gain.setValueAtTime(0, context.currentTime);
      oscillator.connect(gain); gain.connect(this.#bus ?? context.destination);
      this.#whistleVoice = { oscillator, gain }; oscillator.start();
    }
    this.#whistleVoice.oscillator.frequency.setTargetAtTime(whistle.frequency + Math.sin(context.currentTime * 41) * whistle.gain * 2200, context.currentTime, .025);
    this.#whistleVoice.gain.gain.setTargetAtTime(whistle.gain, context.currentTime, .1);
  }

  #stopWhistle(): void {
    if (this.#whistleVoice === null) return;
    this.#whistleVoice.oscillator.stop(); this.#whistleVoice.oscillator.disconnect(); this.#whistleVoice.gain.disconnect();
    this.#whistleVoice = null;
  }

  #stopSpeed(): void {
    this.#stopWhistle();
    const voice = this.#speedVoice;
    if (voice === null) return;
    this.#speedVoice = null;
    voice.oscillator.stop(); voice.oscillator.disconnect(); voice.gain.disconnect();
  }
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
    oscillator.type = kind === "break" || kind === "impact" || kind === "zone-trap" || kind === "zone-shatter" ? "triangle" : "sine";
    oscillator.frequency.setValueAtTime(start, now);
    oscillator.frequency.exponentialRampToValueAtTime(end, now + duration);
    gain.gain.setValueAtTime(.001, now);
    gain.gain.linearRampToValueAtTime(kind.startsWith("zone-") ? .045 : kind === "coin" ? .1 : .16 * weight, now + .008);
    gain.gain.exponentialRampToValueAtTime(.001, now + duration);
    oscillator.connect(gain); gain.connect(this.#bus??context.destination);
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
      source.connect(filter); filter.connect(noiseGain); noiseGain.connect(this.#bus??context.destination);
      this.#voices.add(source);
      source.onended = () => { source.disconnect(); filter.disconnect(); noiseGain.disconnect(); this.#voices.delete(source); };
      source.start(now, 0, length);
    }
    // A short rising overtone follows the initial low crack. Dense cascades share a rate limit.
    if (kind === "break" && this.#voices.size < 8 && now - this.#lastRiser >= .12) {
      this.#lastRiser = now;
      const rise = context.createOscillator(), riseGain = context.createGain();
      const onset = now + .025, length = .13;
      rise.type = "sine";
      rise.frequency.setValueAtTime(360, onset);
      rise.frequency.exponentialRampToValueAtTime(700 + weight * 500, onset + length);
      riseGain.gain.setValueAtTime(.001, now);
      riseGain.gain.linearRampToValueAtTime(.025 * weight, onset + .015);
      riseGain.gain.exponentialRampToValueAtTime(.001, onset + length);
      rise.connect(riseGain); riseGain.connect(this.#bus ?? context.destination);
      this.#voices.add(rise);
      rise.onended = () => { rise.disconnect(); riseGain.disconnect(); this.#voices.delete(rise); };
      rise.start(onset); rise.stop(onset + length);
    }
  }
  public playBreak(material:BreakMaterial,speed:number,force=1,power=false):boolean{
    const ctx=this.#context;
    if(ctx?.state!=="running"||document.hidden||!document.hasFocus()||document.documentElement.dataset.effectsEnabled==="false"||this.#voices.size>9)return false;
    const profile=breakSoundProfile(material,speed,power),now=ctx.currentTime,d=profile.duration;
    const level=profile.gain*Math.max(.7,Math.min(1.5,force));
    if(this.#noise===null){this.#noise=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*.32),ctx.sampleRate);const data=this.#noise.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;}
    const finish=(source:AudioScheduledSourceNode,nodes:AudioNode[],end:number):void=>{
      this.#voices.add(source);source.onended=()=>{source.disconnect();for(const node of nodes)node.disconnect();this.#voices.delete(source);};source.start(now);source.stop(end);
    };
    // Low pressure pulse, material fracture, then the short passing whistle.
    const thump=ctx.createOscillator(),low=ctx.createGain();thump.type="triangle";
    thump.frequency.setValueAtTime(profile.thump,now);thump.frequency.exponentialRampToValueAtTime(34,now+d*.70);
    low.gain.setValueAtTime(.001,now);low.gain.linearRampToValueAtTime(.105*level,now+.004);low.gain.exponentialRampToValueAtTime(.001,now+d*.72);
    thump.connect(low);low.connect(this.#bus??ctx.destination);finish(thump,[low],now+d);
    const crack=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),texture=ctx.createGain();crack.buffer=this.#noise;
    filter.type=material==="bubble"?"lowpass":"bandpass";filter.Q.value=material==="bubble"?5:material==="stone"?.8:.4;
    filter.frequency.setValueAtTime(profile.crack,now);filter.frequency.exponentialRampToValueAtTime(profile.crack*.32,now+d);
    texture.gain.setValueAtTime(.001,now);texture.gain.linearRampToValueAtTime(.085*level,now+.008);
    if(material==="stone"){texture.gain.linearRampToValueAtTime(.02*level,now+d*.20);texture.gain.linearRampToValueAtTime(.07*level,now+d*.29);texture.gain.linearRampToValueAtTime(.025*level,now+d*.42);}
    texture.gain.exponentialRampToValueAtTime(.001,now+d);
    crack.connect(filter);filter.connect(texture);texture.connect(this.#bus??ctx.destination);finish(crack,[filter,texture],now+d);
    const whistle=ctx.createOscillator(),air=ctx.createGain();whistle.type="sine";
    whistle.frequency.setValueAtTime(profile.whistle*.45,now);whistle.frequency.exponentialRampToValueAtTime(profile.whistle,now+d);
    air.gain.setValueAtTime(.001,now);air.gain.linearRampToValueAtTime(.035*level,now+d*.25);air.gain.exponentialRampToValueAtTime(.001,now+d);
    whistle.connect(air);air.connect(this.#bus??ctx.destination);finish(whistle,[air],now+d);
    return true;
  }
  public stop(): void {
    this.#stopSpeed();
    for (const voice of this.#voices) { try { voice.stop(); } catch { /* Already stopped. */ } }
    this.#voices.clear();
  }
}
let sounds: GameSounds | null = null;
export function getGameSounds(): GameSounds { return sounds ??= new GameSounds(); }
