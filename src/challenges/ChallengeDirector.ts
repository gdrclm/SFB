import type { WorldProgression } from "../progression/WorldProgression";
import type { PlatformEncounterTheme } from "../platform/PlatformRoutePlanner";

export const CHALLENGES = [
  { theme: "run-up", title: "Разгон", text: "Лови ритм и набирай скорость." },
  { theme: "breather", title: "Передышка", text: "Восстанови контроль и сохрани разгон." },
  { theme: "climax", title: "Кульминация", text: "Каскад, повороты и рискованная добыча." },
  { theme: "rich-lane", title: "Рискованная добыча", text: "Больше монет за сложным маршрутом. Сверь скорость и цену BOOST перед входом." },
  { theme: "trap", title: "Манёвренный коридор", text: "Проход меняет сторону. Планируй следующий поворот заранее." },
  { theme: "bait", title: "Приманка", text: "Монеты зовут на другую сторону. Под последней группой — ловушка." },
  { theme: "death-tunnel", title: "Напряжённый участок", text: "Держись внутри коридора: по краям сверхпрочные платформы." },
  { theme: "chaos", title: "Мозаика", text: "Несколько типов платформ в одном ряду. Сравнивайте прочность со скоростью." },
  { theme: "break-run", title: "Разрушительный каскад", text: "Пробивай цепочку платформ и наращивай комбо." },
] as const satisfies readonly { theme: PlatformEncounterTheme; title: string; text: string }[];
export type Challenge = (typeof CHALLENGES)[number];

/** Runs on the simulation clock: pauses, tutorial cards and slow mode apply naturally. */
export class ChallengeDirector {
  readonly #random: () => number;
  readonly #start: (challenge: Challenge) => void;
  #remaining: number;
  #next = 0;
  readonly #progression: (() => WorldProgression) | undefined;
  readonly #completedSequences:(()=>number)|undefined;
  #sequenceBase=0;#elapsed=0;
  public constructor(start: (challenge: Challenge) => void, random = Math.random, progression?: () => WorldProgression,completedSequences?:()=>number) {
    this.#progression = progression;
    this.#start = start; this.#random = random; this.#remaining = this.#interval();
    this.#completedSequences=completedSequences;this.#sequenceBase=completedSequences?.()??0;
  }
  #interval(): number {
    const spread = this.#next >= 6 ? 5 : this.#next >= 3 ? 10 : 20;
    return 20 + Math.max(0, Math.min(1, this.#random())) * spread;
  }
  public fixedUpdate(delta: number): void {
    if(!Number.isFinite(delta)||delta<=0)return;
    if(this.#completedSequences){
      const completed=this.#completedSequences();
      if(completed<this.#sequenceBase){this.#sequenceBase=completed;this.#elapsed=0;}
      this.#elapsed+=delta;
      const phase=this.#progression?.().phase;
      const minimumSeconds=phase==="climax"?8:phase==="development"?10:12;
      const minimumSequences=phase==="climax"?3:2;
      if(this.#elapsed<minimumSeconds||completed-this.#sequenceBase<minimumSequences)return;
      this.#startNext();this.#sequenceBase=completed;this.#elapsed=0;
      return;
    }
    this.#remaining -= delta;
    while (this.#remaining <= 1e-9) {
      this.#startNext();
      this.#remaining += this.#interval();
    }
  }
  #startNext():void{
      const phase = this.#progression?.().phase;
      const themes: readonly PlatformEncounterTheme[] = phase === "introduction" ? ["break-run", "run-up", "rich-lane", "breather"]
        : phase === "development" ? ["trap", "rich-lane", "break-run", "bait", "death-tunnel", "breather"]
        : phase === "climax" ? ["climax", "breather", "death-tunnel", "rich-lane", "break-run", "breather"]
        : ["rich-lane", "trap", "bait", "death-tunnel", "chaos", "break-run"];
      const theme = themes[this.#next % themes.length];
      const challenge = CHALLENGES.find(candidate => candidate.theme === theme);
      if (challenge !== undefined) this.#start(challenge);
      this.#next++;
  }
}
