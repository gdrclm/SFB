import { getBrowserRunHistory } from "../run/RunHistory";
import { getPlayerProfile, SHOP_ITEMS, type ShopCategory } from "./PlayerProfile";

const categories: readonly [ShopCategory, string][] = [
  ["upgrade", "Улучшения"], ["ball", "Персонаж"], ["world", "Мир"], ["props", "Декорации"], ["vfx", "VFX"],
];
export class ShopController {
  readonly #dialog: HTMLDialogElement;
  readonly #profile = getPlayerProfile();
  #category: ShopCategory = "upgrade";

  public constructor(dialog: HTMLDialogElement) {
    this.#dialog = dialog;
    const filters = this.#element("#shop-categories");
    for (const [category, label] of categories) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.dataset.category = category;
      button.addEventListener("click", () => { this.#category = category; this.#render(); });
      filters.append(button);
    }
    this.#element("#shop-close").addEventListener("click", () => { dialog.close(); });
  }

  public refreshBalance(): void {
    this.#profile.creditRuns(getBrowserRunHistory().all());
    for (const label of document.querySelectorAll<HTMLElement>("[data-bank-coins]")) label.textContent = String(this.#profile.coins);
  }

  public open(): void {
    this.refreshBalance();
    this.#element("#shop-message").textContent = "";
    this.#render();
    this.#dialog.showModal();
  }

  #element(selector: string): HTMLElement {
    const element = this.#dialog.querySelector<HTMLElement>(selector);
    if (element === null) throw new Error(`Missing shop element: ${selector}`);
    return element;
  }

  #render(): void {
    this.refreshBalance();
    this.#element("#shop-storage-status").textContent = this.#profile.storageAvailable ? ""
      : "Не удалось прочитать или сохранить профиль. Покупки недоступны. Проверьте доступ к хранилищу браузера.";
    for (const button of this.#dialog.querySelectorAll<HTMLButtonElement>("[data-category]")) {
      button.setAttribute("aria-pressed", String(button.dataset.category === this.#category));
    }
    const grid = this.#element("#shop-items");
    grid.replaceChildren();
    for (const item of SHOP_ITEMS.filter((entry) => entry.category === this.#category)) {
      const card = document.createElement("article");
      card.className = "shop-item";
      card.dataset.item = item.id;
      const preview = document.createElement("div");
      preview.className = "shop-preview";
      preview.dataset.preview = item.id;
      preview.setAttribute("aria-hidden", "true");
      preview.textContent = item.preview;
      const title = document.createElement("h2"); title.textContent = item.name;
      const description = document.createElement("p"); description.className = "shop-item-description"; description.textContent = item.description;
      description.hidden = item.category !== "upgrade";
      card.title = item.description;
      const info = document.createElement("p"); info.className = "shop-item-state";
      const action = document.createElement("button"); action.type = "button";
      const level = this.#profile.level(item.id);
      const owned = this.#profile.owns(item.id);
      const maxed = item.maxLevel !== undefined && level >= item.maxLevel;
      const equipped = item.category !== "upgrade" && this.#profile.equipment[item.category] === item.id;
      info.textContent = item.maxLevel === undefined ? owned ? "Куплено" : "Не куплено" : `Уровень ${String(level)} / ${String(item.maxLevel)}`;
      const price = this.#profile.price(item);
      action.textContent = maxed ? "Максимум" : equipped ? "Выбрано" : owned ? "Выбрать"
        : `${item.category === "upgrade" ? "Улучшить" : "Купить"} · ${String(price)} ★`;
      action.disabled = maxed || equipped || !this.#profile.storageAvailable || !owned && this.#profile.coins < price;
      if (!owned && !maxed && this.#profile.coins < price) action.title = `Не хватает ${String(price - this.#profile.coins)} монет`;
      action.addEventListener("click", () => {
        const success = owned ? this.#profile.equip(item.id) : this.#profile.buy(item.id);
        this.#render();
        this.#element("#shop-message").textContent = success
          ? owned ? `${item.name}: выбрано для следующего забега.`
            : item.category === "upgrade" ? "Улучшение куплено. Применится в следующем забеге." : "Предмет куплен. Нажмите «Выбрать», чтобы использовать."
          : "Не удалось выполнить покупку или сохранить выбор.";
        this.#dialog.querySelector<HTMLButtonElement>(`[data-item="${item.id}"] button`)?.focus();
      });
      card.append(preview, title, description, info, action);
      grid.append(card);
    }
  }
}
