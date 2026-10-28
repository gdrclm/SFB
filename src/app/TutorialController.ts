import { tutorialInput } from "../tutorial/GuideHints";
import type { PlatformKind } from "../config/gameConfig";
import { platformPreviewMarkup } from "../platform/PlatformSprites";
import { platformSpriteRow } from "../platform/PlatformSpriteLayout";

const SEEN_KEY = "speed-fall-ball.tutorial-seen.v1";
const heart = '<svg class="tutorial-icon heart-icon" viewBox="0 0 32 32" aria-hidden="true"><path d="M16 28 4 16C-5 5 10-2 16 7 22-2 37 5 28 16Z" fill="#ff527e" stroke="#760d37" stroke-width="2"/></svg>';
const coin = '<span class="tutorial-icon tutorial-coin" aria-hidden="true">★</span>';
const energy = '<span class="tutorial-icon tutorial-energy" aria-hidden="true">ϟ</span>';
const boost = '<span class="tutorial-key tutorial-boost" aria-hidden="true">BOOST</span>';
const slow = '<span class="tutorial-key" aria-hidden="true">ϟ ЗАМЕДЛЕНИЕ</span>';
const clock = '<svg class="tutorial-icon" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="13" fill="#d5f7ff" stroke="#16799f" stroke-width="3"/><path d="M16 6V16L23 19" fill="none" stroke="#16799f" stroke-width="3"/></svg>';

function platform(kind: PlatformKind, strength: number): string {
  return platformPreviewMarkup(platformSpriteRow(kind, kind === "super-heavy" ? "danger" : null), `Платформа, прочность ${String(strength)}`);
}

export const tutorialVisuals = { heart, coin, energy, boost, slow, clock, platform };

const steps = [
  {
    title: "Управление и цель",
    content: `<div class="tutorial-control-demo" aria-hidden="true"><span>←</span><span class="tutorial-ball">●</span><span>→</span></div>
      <p>Свайпай в любом месте ↔. На ПК — веди курсор. Шар падает сам.</p>
      <p>Плавный или короткий свайп — точная поправка. Широкий резкий свайп — быстрый манёвр.</p>
      <p>${coin} Собирайте монеты, разбивайте платформы и спускайтесь глубже.</p>`,
  },
  {
    title: "Пробитие и BOOST",
    content: `<p>${platform("standard", 7)} <span class="cue-key cue-safe">Бирюзовый — пробьётся.</span> <span class="cue-key cue-boost">ϟ — хватит BOOST.</span> <span class="cue-key">Нейтральный — нужен разгон.</span> <span class="cue-key cue-danger">! — обходите.</span></p>
      <p>${boost} <strong>Серия пробитий → один заряд.</strong> Нажми: +50% скорости. Ошибка сбрасывает незавершённую серию.</p>
      <p>${heart} Не хватило скорости: −1 жизнь, скорость снова 10.</p>`,
  },
  {
    title: "Монеты и замедление",
    content: `<p>${coin} Монета: <strong>+1 скорости, +2 энергии</strong> без улучшений.</p>
      <p>${slow} Замедляет время, тратит энергию. BOOST возвращает обычную скорость.</p>
      <p>Монеты сохраняются после забега. Покупки — в магазине.</p>`,
  },
  {
    title: "Типы платформ",
    content: `<div class="tutorial-platform-list">
      <article>${platform("standard", 7)}<div><h2>Обычная</h2><p>Хватает скорости — разбивайте.</p></div></article>
      <article>${platform("super-heavy", 25)}<div><h2>Сверхпрочная</h2><p>Нужен разгон или обход.</p></div></article>
      <article>${platform("vitality", 10)}<div><h2>Восстановление</h2><p>${heart} +1 жизнь, ${energy} +10 энергии.</p></div></article>
      <article>${platform("time-slow", 12)}<div><h2>Замедление</h2><p>${clock} Замедляет на 3 секунды.</p></div></article>
      </div>`,
  },
  {
    title: "Движение, ветер и турели",
    content: '<p><span class="tutorial-key">↔</span> Синяя каретка с двигателями движется по направляющим. Следите за её ходом.</p><p><span class="tutorial-key">➜</span> Бирюзовая турбина посылает видимые струи воздуха в сторону прохода. Удерживайте траекторию против порыва.</p><p><span class="tutorial-key">⊕</span> Бронированная турель поворачивает ствол и фиксирует линию прицеливания. Сместитесь с линии или разбейте турель. Снаряд летит прямо и снимает одну жизнь.</p><p>При первом знакомстве с каждым механизмом падение ненадолго становится плавнее. Набранная скорость сохраняется; затем возвращается обычный темп.</p>',
  },
  {
    title: "Способности",
    content: '<p><span class="tutorial-key">◉ Аннигиляция</span> Нажми — очистить экран. Держи 2 секунды — взрыв на 200 м за все 4 заряда.</p><p><span class="tutorial-key">✺ Плазма</span> 30 секунд разгона и неуязвимости.</p><p>Одну способность выбираешь в магазине. В забеге она слева внизу.</p>',
  },
  {
    title: "Комбо и рекорды",
    content: `<p><span class="tutorial-key">КОМБО</span> Комбо заряжает BOOST. Ошибка сбрасывает серию.</p>
      <p>Больше скорости и риска — больше очков. Рекорды и монеты сохраняются автоматически.</p>
      <p>${platform("standard", 7)} Бирюзовый — пробьётся. Янтарная ϟ — хватит BOOST. Красный ! — обходите.</p>`,
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
    content.innerHTML = tutorialInput() === "desktop" ? step.content
      .replace("Свайпай в любом месте ↔. На ПК — веди курсор.", "Веди курсор ↔.")
      .replace("Нажми: +50% скорости.", "ПКМ: +50% скорости.")
      .replace("Замедляет время, тратит энергию.", "Пробел: замедлить время, тратит энергию.")
      .replace("Нажми — очистить экран.", "Пробел — очистить экран.") : step.content;
    progress.textContent = `${String(this.#step + 1)} / ${String(steps.length)}`;
    this.#button("#tutorial-back").disabled = this.#step === 0;
    this.#button("#tutorial-next").textContent = this.#step === steps.length - 1
      ? this.#onStart === null ? "Понятно" : "Начать забег" : "Далее";
    this.#button("#tutorial-skip").textContent = this.#onStart === null ? "Закрыть" : "Пропустить и играть";
    this.#dialog.scrollTop = 0;
  }
}
