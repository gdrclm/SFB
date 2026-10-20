import { tutorialVisuals as art } from "../app/TutorialController";
import type { GuideTip } from "./StagedOpening";

const tips: Record<GuideTip, { title: string; art: string; text: string }> = {
  platform: { title: "Первая платформа", art: art.platform("standard", 7), text: "Ведите шар пальцем влево-вправо. Для пробития скорость должна быть не ниже числа на платформе." },
  coin: { title: "Первая монета", art: art.coin, text: "Подберите монету: +1 к скорости и энергия. После забега монеты можно тратить в магазине." },
  boost: { title: "Пора ускориться", art: `${art.platform("standard", 14)} ${art.boost}`, text: "Нажмите BOOST: скорость вырастет на 50%. Цена — на кнопке, перезарядка — 1 секунда." },
  fork: { title: "Первая развилка", art: `${art.platform("standard", 8)} ${art.platform("super-heavy", 25)}`, text: "Сравните числа со своей скоростью. Выберите: пробить, ускориться или обойти." },
  free: { title: "Первые 30 секунд пройдены", art: "↘ ✦ ↙", text: "Дальше — случайные испытания. Собирайте монеты и продолжайте серию ударов." },
  life: { title: "Одна жизнь потеряна", art: `${art.heart} ${art.heart} <span class="guide-lost-heart">${art.heart}</span>`, text: "Не хватило скорости: −1 жизнь, скорость снова 10, комбо сброшено. После отскока используйте BOOST или обход." },
  combo: { title: "Вы собрали комбо", art: "КОМБО ×2", text: "3 удара подряд дают ×2. Продолжайте серию для большего бонуса; ошибка её сбросит." },
  vitality: { title: "Платформа восстановления", art: `${art.platform("vitality", 10)} ${art.heart}`, text: "Разбейте зелёную платформу: +1 жизнь (до трёх) и +10 энергии." },
  "time-slow": { title: "Платформа замедления", art: `${art.platform("time-slow", 12)} ${art.clock}`, text: "Разбейте белую платформу: время замедлится на 3 секунды. В это время BOOST недоступен." },
  "super-heavy": { title: "Сверхпрочная платформа", art: art.platform("super-heavy", 25), text: "Тёмная платформа требует высокой скорости. Если BOOST не хватит — обходите." },
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
