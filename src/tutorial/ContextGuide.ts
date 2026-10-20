import { tutorialVisuals as art } from "../app/TutorialController";
import type { GuideTip } from "./StagedOpening";

const tips: Record<GuideTip, { title: string; art: string; text: string }> = {
  platform: { title: "Первая платформа", art: art.platform("standard", 7), text: "Шар падает сам. Число на платформе — нужная скорость для пробития. Эта платформа простая: продолжите и попробуйте удар. Зажмите экран или мышь и ведите влево-вправо, чтобы направлять шар." },
  coin: { title: "Первая монета", art: art.coin, text: "Внизу появилась монета. Направьте шар к ней: она даст +1 скорости и энергию. Собранные монеты сохранятся после забега — за них можно покупать предметы в магазине." },
  boost: { title: "Пора ускориться", art: `${art.platform("standard", 14)} ${art.boost}`, text: "Впереди платформа прочнее текущей скорости. После закрытия подсказки нажмите BOOST: он увеличит скорость на 50%. Цена указана на кнопке, перезарядка — 1 секунда. Можно и обойти платформу, но пробитие продолжит серию." },
  fork: { title: "Первая развилка", art: `${art.platform("standard", 8)} ${art.platform("super-heavy", 25)}`, text: "Теперь впереди два разных пути. Золотая — обычная платформа, тёмная с оранжевым краем — сверхпрочная. Сравните их числа со своей скоростью и выберите: пробить, ускориться или обойти. Игра не выбирает дорожку за вас." },
  free: { title: "Первые 30 секунд пройдены", art: "↘ ✦ ↙", text: "Постановка закончена. Дальше начинаются случайные испытания. Собирайте монеты, держите комбо и выбирайте риск. Новые типы платформ объясню, когда они впервые появятся." },
  life: { title: "Одна жизнь потеряна", art: `${art.heart} ${art.heart} <span class="guide-lost-heart">${art.heart}</span>`, text: "Скорости для удара не хватило: шар отскочил, скорость сбросилась до 10, серия комбо прервалась. Одна платформа может снять только одну жизнь за своё появление. Попробуйте другой путь или используйте BOOST после отскока." },
  combo: { title: "Вы собрали комбо", art: "КОМБО ×2", text: "Три успешных удара подряд дают множитель ×2! На 6 / 10 / 15 ударах он вырастет до ×3 / ×4 / ×5. Ошибка сбрасывает серию, но заработанные очки остаются. Высокая скорость и удар на грани прочности дают больше очков." },
  vitality: { title: "Платформа восстановления", art: `${art.platform("vitality", 10)} ${art.heart}`, text: "На экране появилась зелёная платформа с сердцем. Разрушьте её при достаточной скорости: восстановится одна жизнь (максимум три), а энергия увеличится на 10." },
  "time-slow": { title: "Платформа замедления", art: `${art.platform("time-slow", 12)} ${art.clock}`, text: "Бело-голубая платформа с часами при разрушении замедляет время на 3 секунды. Во время замедления BOOST недоступен. Теперь доступна и кнопка ручного замедления: она расходует энергию." },
  "super-heavy": { title: "Сверхпрочная платформа", art: art.platform("super-heavy", 25), text: "Тёмная платформа с оранжевым краем обычно требует значительно большей скорости. Читайте число: иногда выгоднее обойти её, чем тратить энергию и рисковать жизнью." },
};

export class ContextGuide {
  readonly #dialog: HTMLDialogElement;
  readonly #pause: () => void;
  readonly #resume: () => void;
  readonly #skip: () => void;
  readonly #queue: { tip: GuideTip; strengths: readonly number[] }[] = [];
  #active = false;

  public constructor(dialog: HTMLDialogElement, pause: () => void, resume: () => void, skip: () => void) {
    this.#dialog = dialog; this.#pause = pause; this.#resume = resume; this.#skip = skip;
    dialog.querySelector("#context-continue")?.addEventListener("click", () => { this.#advance(); });
    dialog.querySelector("#context-skip")?.addEventListener("click", () => {
      this.#queue.length = 0; this.#skip(); this.#advance();
    });
    dialog.addEventListener("keydown", (event) => { event.stopPropagation(); });
    dialog.addEventListener("cancel", (event) => { event.preventDefault(); this.#advance(); });
  }

  public show(tip: GuideTip, strengths: readonly number[] = []): void {
    this.#queue.push({ tip, strengths: [...strengths] });
    if (this.#active) return;
    this.#active = true; this.#pause(); this.#renderNext(); this.#dialog.showModal();
    this.#dialog.querySelector<HTMLButtonElement>("#context-continue")?.focus({ preventScroll: true });
  }

  #renderNext(): void {
    const event = this.#queue.shift();
    if (event === undefined) return;
    const { tip, strengths } = event;
    this.#dialog.dataset.tip = tip;
    this.#dialog.dataset.anchor = ["life", "combo", "free"].includes(tip) ? "bottom" : "top";
    const data = tips[tip];
    const title = this.#dialog.querySelector<HTMLElement>("#context-title");
    const picture = this.#dialog.querySelector<HTMLElement>("#context-picture");
    const text = this.#dialog.querySelector<HTMLElement>("#context-text");
    if (title === null || picture === null || text === null) throw new Error("Missing contextual guide elements");
    let illustration = data.art;
    const strength = strengths[0];
    if (tip === "fork" && strength !== undefined && strengths[1] !== undefined) {
      illustration = `${art.platform("standard", strength)} ${art.platform("super-heavy", strengths[1])}`;
    } else if (strength !== undefined && ["platform", "boost", "vitality", "time-slow", "super-heavy"].includes(tip)) {
      const kind = tip === "vitality" || tip === "time-slow" || tip === "super-heavy" ? tip : "standard";
      illustration = art.platform(kind, strength) + (tip === "boost" ? art.boost : tip === "vitality" ? art.heart : tip === "time-slow" ? art.clock : "");
    }
    title.textContent = data.title; picture.innerHTML = illustration; text.textContent = data.text;
  }
  #advance(): void {
    if (this.#queue.length > 0) { this.#renderNext(); return; }
    if (!this.#active) return;
    this.#active = false; this.#dialog.close(); this.#resume();
  }
  public dispose(): void {
    this.#active = false; this.#queue.length = 0; this.#dialog.close();
    // Release listeners when a restarted game creates its next guide instance.
    this.#dialog.replaceWith(this.#dialog.cloneNode(true));
  }
}
