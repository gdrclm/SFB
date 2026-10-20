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
    title: "Направляйте падение",
    content: `<div class="tutorial-control-demo" aria-hidden="true"><span>←</span><span class="tutorial-ball">●</span><span>→</span></div>
      <p><strong>Зажмите мышь или коснитесь экрана</strong> и ведите влево-вправо — шар следует за пальцем или указателем. Он падает сам. После отпускания остаётся небольшая инерция.</p>
      <p>${coin} Собирайте монеты, разбивайте платформы и спускайтесь как можно глубже. Цель — побить свой рекорд очков и пройти 10 этапов первой фазы.</p>
      <p><span class="tutorial-key" aria-hidden="true">Ⅱ</span> Кнопка паузы останавливает игру. Обучение можно снова открыть на старте или в паузе.</p>`,
  },
  {
    title: "Скорость, энергия и жизни",
    content: `<p>${boost} Нажмите BOOST: каждый успешный буст даёт <strong>+50% к текущей скорости</strong> (10 → 15 → 22,5 → 33,8). Чем выше скорость, тем шире обзор камеры. Перезарядка — 1 секунда. ${energy} Буст тратит энергию; его цена растёт со скоростью и указана на кнопке.</p>
      <p>${coin} Монета даёт <strong>+1 к скорости и базово +2 энергии</strong> (больше с улучшением из магазина). ${slow} Замедляет время до 10% и расходует 1 энергию каждые 3 секунды. Во время замедления или отскока буст заблокирован.</p>
      <p>${heart}${heart}${heart} Начинаете с тремя жизнями. Если скорости недостаточно для платформы — отскок, <strong>−1 жизнь</strong> и сброс скорости до 10. Одна платформа отнимает максимум одну жизнь за своё появление.</p>
      <p>${platform("standard", 7)} Число на платформе — её прочность. При скорости <strong>7 и выше</strong> этот пример разобьётся; разрушение отнимает 1 скорости. Сравнивайте число с «УРОВЕНЬ ПРОБИТИЯ» вверху.</p>`,
  },
  {
    title: "Узнавайте платформы",
    content: `<div class="tutorial-platform-list">
      <article>${platform("standard", 7)}<div><h2>Обычная · золотая</h2><p>Разбивайте, если скорости хватает, или обходите сбоку. Встречаются узкие и разделённые платформы: ищите просветы.</p></div></article>
      <article>${platform("super-heavy", 25)}<div><h2>Сверхпрочная · тёмная с оранжевым краем</h2><p>Требует больше скорости. Смотрите на число: заранее используйте ${boost} или выберите обход.</p></div></article>
      <article>${platform("vitality", 10)}<div><h2>Восстановление · зелёная ${heart}</h2><p>При разрушении восстанавливает ${heart} одну жизнь (максимум три) и даёт ${energy} 10 энергии.</p></div></article>
      <article>${platform("time-slow", 12)}<div><h2>Замедление · бело-голубая ${clock}</h2><p>При разрушении включает замедление на ${clock} 3 секунды. В это время ${boost} недоступен.</p></div></article>
      </div><p class="tutorial-note">Числа на рисунках — примеры. В игре прочность меняется с этапом и типом платформы.</p>`,
  },
  {
    title: "Соберите свой рекорд",
    content: `<p><span class="tutorial-key" aria-hidden="true">↓ М</span> Считается <strong>максимальная глубина</strong>: отскоки её не уменьшают.</p>
      <div class="tutorial-score"><span>1 м = <strong>1 очко</strong></span><span>${coin} монета = <strong>10 очков</strong></span><span>${platform("standard", 7)} разрушение = <strong>25 очков + бонусы</strong></span></div>
      <p><span class="tutorial-key">КОМБО ×2 → ×5</span> Успешные удары подряд повышают множитель на 3 / 6 / 10 / 15 ударах. Ошибка сбрасывает серию; заработанные очки остаются. Скорость 20 / 35 / 55 даёт бонус ×1,25 / ×1,5 / ×2. Пробитие с запасом скорости не больше 15% даёт ещё ×1,5.</p>
      <p>${platform("standard", 7)} Только ближайшая платформа под шаром реагирует на скорость: слабое свечение — пробивается, янтарный контур — не хватает немного, красный — большой дефицит. Соседние дорожки не подсвечиваются. Число — точный целый порог скорости.</p>
      <p>${heart} Закончились жизни — забег завершён. Очки и длина сохраняются автоматически. Прерванные забеги тоже сохраняются; топ-10 доступен на старте, в паузе и после проигрыша.</p>
      <p>Собранные монеты зачисляются в постоянный баланс после забега. В главном меню откройте «Магазин»: улучшайте энергию, выбирайте скины и атмосферные эффекты. Покупки и рекорды хранятся в этом браузере. Удачного падения!</p>`,
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
