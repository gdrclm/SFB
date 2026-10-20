import type { PlatformKind } from "../config/gameConfig";
import { createPlatformOutline } from "../platform/PlatformOutline";

const SEEN_KEY = "speed-fall-ball.tutorial-seen.v1";
const heart = '<svg class="tutorial-icon heart-icon" viewBox="0 0 32 32" aria-hidden="true"><path d="M16 28 4 16C-5 5 10-2 16 7 22-2 37 5 28 16Z" fill="#ff527e" stroke="#760d37" stroke-width="2"/></svg>';
const coin = '<span class="tutorial-icon tutorial-coin" aria-hidden="true">★</span>';
const energy = '<span class="tutorial-icon tutorial-energy" aria-hidden="true">ϟ</span>';
const boost = '<span class="tutorial-key tutorial-boost" aria-hidden="true">BOOST</span>';
const slow = '<span class="tutorial-key" aria-hidden="true">ϟ ЗАМЕДЛЕНИЕ</span>';
const clock = '<svg class="tutorial-icon" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="13" fill="#d5f7ff" stroke="#16799f" stroke-width="3"/><path d="M16 6V16L23 19" fill="none" stroke="#16799f" stroke-width="3"/></svg>';

function platform(kind: PlatformKind, strength: number): string {
  const colors = { standard: "#e9a740", "super-heavy": "#434956", vitality: "#27bf66", "time-slow": "#c2f2ff" };
  const points = createPlatformOutline(kind, 168, 40)
    .map(({ x, y }) => `${String(x + 90)},${String(28 - y)}`).join(" ");
  const effect = kind === "vitality" ? '<path d="M25 37 14 26C7 18 18 12 25 20 32 12 43 18 36 26Z" fill="#e8ffed"/>'
    : kind === "time-slow" ? '<circle cx="26" cy="28" r="12" fill="#fff" stroke="#197da3" stroke-width="2"/><path d="M26 19V28L32 31" fill="none" stroke="#197da3" stroke-width="2"/>' : '';
  return `<svg class="tutorial-platform" viewBox="0 0 180 56" role="img" aria-label="Платформа, прочность ${String(strength)}"><polygon points="${points}" fill="${colors[kind]}" stroke="${kind === "super-heavy" ? '#e65d22' : '#183e52'}" stroke-width="3"/><path d="M50 10 46 24 59 34 53 46M123 10 130 26 119 42M8 28H172" fill="none" stroke="#122d40" stroke-opacity=".25" stroke-width="2"/>${effect}<text x="95" y="37" text-anchor="middle" fill="white" stroke="#17394f" stroke-width="3" paint-order="stroke" font-size="26" font-family="Arial, sans-serif" font-weight="900">${String(strength)}</text></svg>`;
}

export const tutorialVisuals = { heart, coin, energy, boost, slow, clock, platform };

const steps = [
  {
    title: "Управление и цель",
    content: `<div class="tutorial-control-demo" aria-hidden="true"><span>←</span><span class="tutorial-ball">●</span><span>→</span></div>
      <p>Ведите пальцем или мышью влево-вправо. Шар падает сам.</p>
      <p>${coin} Собирайте монеты, разбивайте платформы и спускайтесь глубже.</p>`,
  },
  {
    title: "Пробитие и BOOST",
    content: `<p>${platform("standard", 7)} Скорость ≥ числа на платформе — она разобьётся.</p>
      <p>${boost} <strong>+50% скорости.</strong> Цена ${energy} — на кнопке. Перезарядка — 1 секунда.</p>
      <p>${heart} Не хватило скорости: −1 жизнь, скорость снова 10.</p>`,
  },
  {
    title: "Монеты и замедление",
    content: `<p>${coin} Монета: <strong>+1 скорости, +2 энергии</strong> без улучшений.</p>
      <p>${slow} Замедляет время, тратит энергию. BOOST временно недоступен.</p>
      <p>Монеты сохраняются после забега. Покупки — в магазине.</p>`,
  },
  {
    title: "Типы платформ",
    content: `<div class="tutorial-platform-list">
      <article>${platform("standard", 7)}<div><h2>Обычная</h2><p>Хватает скорости — разбивайте.</p></div></article>
      <article>${platform("super-heavy", 25)}<div><h2>Сверхпрочная</h2><p>Нужен разгон или обход.</p></div></article>
      <article>${platform("vitality", 10)}<div><h2>Восстановление</h2><p>${heart} +1 жизнь, ${energy} +10 энергии.</p></div></article>
      <article>${platform("time-slow", 12)}<div><h2>Замедление</h2><p>${clock} 3 секунды без BOOST.</p></div></article>
      </div>`,
  },
  {
    title: "Комбо и рекорды",
    content: `<p><span class="tutorial-key">КОМБО</span> 3 / 6 / 10 / 15 ударов подряд: ×2 / ×3 / ×4 / ×5. Ошибка сбрасывает серию.</p>
      <p>Больше скорости и риска — больше очков. Рекорды и монеты сохраняются автоматически.</p>
      <p>${platform("standard", 7)} Свечение — пробивается. Янтарный край — чуть не хватает. Красный — опасно.</p>`,
  },
];

export class TutorialController {
  readonly #dialog: HTMLDialogElement;
  #step = 0;
  #onStart: (() => void) | null = null;

  public constructor(dialog: HTMLDialogElement) {
    this.#dialog = dialog;
    // Native dialog handles Escape and focus; keep pause shortcuts underneath inactive.
    dialog.addEventListener("keydown", (event) => { event.stopPropagation(); });
    this.#button("#tutorial-close").addEventListener("click", () => { dialog.close(); });
    this.#button("#tutorial-back").addEventListener("click", () => { this.#step--; this.#render(); });
    this.#button("#tutorial-next").addEventListener("click", () => {
      if (this.#step === steps.length - 1) this.#finish();
      else { this.#step++; this.#render(); }
    });
    this.#button("#tutorial-skip").addEventListener("click", () => { this.#finish(); });
    dialog.addEventListener("close", () => { this.#onStart = null; });
  }

  public get hasSeen(): boolean {
    try { return window.localStorage.getItem(SEEN_KEY) === "true"; }
    catch { return false; }
  }

  public open(onStart: (() => void) | null = null): void {
    this.#onStart = onStart;
    this.#step = 0;
    this.#render();
    this.#dialog.showModal();
    this.#button("#tutorial-next").focus();
  }

  #button(selector: string): HTMLButtonElement {
    const button = this.#dialog.querySelector(selector);
    if (!(button instanceof HTMLButtonElement)) throw new Error(`Missing tutorial button: ${selector}`);
    return button;
  }

  #finish(): void {
    try { window.localStorage.setItem(SEEN_KEY, "true"); }
    catch { /* The tutorial remains available without storage. */ }
    const start = this.#onStart;
    this.#onStart = null;
    this.#dialog.close();
    start?.();
  }

  #render(): void {
    const step = steps[this.#step];
    if (step === undefined) return;
    const title = this.#dialog.querySelector<HTMLElement>("#tutorial-title");
    const content = this.#dialog.querySelector<HTMLElement>("#tutorial-content");
    const progress = this.#dialog.querySelector<HTMLElement>("#tutorial-step");
    if (title === null || content === null || progress === null) throw new Error("Missing tutorial content");
    title.textContent = step.title;
    content.innerHTML = step.content;
    progress.textContent = `${String(this.#step + 1)} / ${String(steps.length)}`;
    this.#button("#tutorial-back").disabled = this.#step === 0;
    this.#button("#tutorial-next").textContent = this.#step === steps.length - 1
      ? this.#onStart === null ? "Понятно" : "Начать забег" : "Далее";
    this.#button("#tutorial-skip").textContent = this.#onStart === null ? "Закрыть" : "Пропустить и играть";
    this.#dialog.scrollTop = 0;
  }
}
