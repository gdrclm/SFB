const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));
const smooth = (value: number): number => { const t = clamp01(value); return t * t * (3 - 2 * t); };

/** Gesture strength uses viewport fractions, never fall speed or camera zoom. */
export class SwipeDynamics {
  #samples: { start: number; end: number; distance: number }[] = [];
  #direction = 0;
  #lastTime = 0;
  #effort = 0;

  public reset(time: number): void {
    this.#samples.length = 0; this.#direction = 0; this.#lastTime = time; this.#effort = 0;
  }

  public record(screenDelta: number, time: number): number {
    if (!Number.isFinite(screenDelta) || !Number.isFinite(time) || time < this.#lastTime) return this.effort(time);
    if (screenDelta === 0) return this.effort(time);
    const direction = Math.sign(screenDelta);
    if (direction !== this.#direction || time - this.#lastTime > 120) this.#samples.length = 0;
    const start = this.#lastTime;
    this.#direction = direction;
    this.#samples.push({ start, end: time, distance: Math.abs(screenDelta) });
    this.#samples = this.#samples.filter(sample => sample.end > time - 100).slice(-128);
    let distance = 0;
    for (const sample of this.#samples) {
      const fraction = sample.end > sample.start ? Math.min(1, (sample.end - (time - 100)) / (sample.end - sample.start)) : 1;
      distance += sample.distance * fraction;
    }
    const duration = Math.max(16, Math.min(100, time - (this.#samples[0]?.start ?? time))) / 1000;
    // A fast tiny twitch and a broad slow drag both stay precise. A committed
    // flick needs both speed (viewport widths/s) and recent directional travel.
    this.#effort = Math.min(smooth((distance / duration - .35) / 2.15), smooth((distance - .008) / .075));
    this.#lastTime = time;
    return this.#effort;
  }

  public effort(time: number): number {
    const idle = Math.max(0, time - this.#lastTime);
    return idle > 200 ? 0 : this.#effort * Math.exp(-idle / 70);
  }
}
