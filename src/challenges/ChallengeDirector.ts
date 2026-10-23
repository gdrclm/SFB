import type { PlatformEncounterTheme } from "../platform/PlatformRoutePlanner";

export const CHALLENGES = [
  { theme: "rich-lane", title: "Золотая развилка", text: "Больше монет за прочной платформой. Сверьте скорость и цену BOOST перед входом." },
  { theme: "trap", title: "Зигзаг", text: "Проход меняет сторону. Планируйте следующий поворот заранее." },
  { theme: "bait", title: "Приманка", text: "Монеты зовут на другую сторону. Под последней группой — ловушка." },
  { theme: "death-tunnel", title: "Узкий коридор", text: "Держитесь внутри коридора: по краям сверхпрочные платформы." },
  { theme: "chaos", title: "Мозаика", text: "Несколько типов платформ в одном ряду. Сравнивайте прочность со скоростью." },
  { theme: "break-run", title: "Каскад", text: "Пробивайте цепочку платформ и наращивайте комбо." },
] as const satisfies readonly { theme: PlatformEncounterTheme; title: string; text: string }[];
export type Challenge = (typeof CHALLENGES)[number];

/** Runs on the simulation clock: pauses, tutorial cards and slow mode apply naturally. */
export class ChallengeDirector {
  readonly #random: () => number;
  readonly #start: (challenge: Challenge) => void;
  #remaining: number;
  #next = 0;
  public constructor(start: (challenge: Challenge) => void, random = Math.random) {
    this.#start = start; this.#random = random; this.#remaining = this.#interval();
  }
  #interval(): number {
    const spread = this.#next >= 6 ? 5 : this.#next >= 3 ? 10 : 20;
    return 20 + Math.max(0, Math.min(1, this.#random())) * spread;
  }
  public fixedUpdate(delta: number): void {
    this.#remaining -= delta;
    while (this.#remaining <= 1e-9) {
      const challenge = CHALLENGES[this.#next % CHALLENGES.length];
      if (challenge !== undefined) this.#start(challenge);
      this.#next++;
      this.#remaining += this.#interval();
    }
  }
}
