import type { RunHistory } from "./RunHistory";

function element(tag: string, className: string, text: string): HTMLElement {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
}

export function renderRunHistory(container: HTMLElement, history: RunHistory): void {
  const best = history.personalBests();
  const summary = container.querySelector("[data-personal-bests]");
  if (summary !== null) {
    summary.replaceChildren();
    for (const [icon, value, label] of [
      ["↓", `${String(best.depth)} м`, "Глубина"],
      ["ϟ", best.maxSpeed.toFixed(1), "Скорость"],
      ["⚑", best.stage === 0 ? "—" : String(best.stage), "Этап"],
    ] as const) {
      const tile = element("div", "record-best", "");
      const symbol = element("span", "record-best-icon", icon);
      symbol.setAttribute("aria-hidden", "true");
      tile.append(symbol, element("strong", "", value), element("span", "", label));
      summary.append(tile);
    }
  }
  const body = container.querySelector("[data-run-records]");
  if (body === null) return;
  body.replaceChildren();
  const records = history.top();
  records.forEach((record, index) => {
    const row = element("li", "record-row", "");
    row.dataset.rank = String(index + 1);
    const rank = element("span", "record-rank", String(index + 1));
    rank.setAttribute("aria-label", `Место ${String(index + 1)}`);
    const copy = element("div", "record-copy", "");
    const score = element("strong", "record-score", record.score.toLocaleString("ru-RU"));
    score.append(element("small", "", " очков"));
    const detail = element("span", "record-detail", `${String(record.depth)} м · серия ${String(record.bestCombo ?? 0)}`);
    copy.append(score, detail);
    const date = element("time", "record-date", new Date(record.finishedAt).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" }));
    date.setAttribute("datetime", record.finishedAt);
    date.title = new Date(record.finishedAt).toLocaleString("ru-RU") + (record.outcome === "interrupted" ? " · Забег прерван" : "");
    row.append(rank, copy, date);
    body.append(row);
  });
  if (records.length === 0) {
    const empty = element("li", "records-empty", "");
    const star = element("span", "", "☆");
    star.setAttribute("aria-hidden", "true");
    empty.append(star, element("strong", "", "Первый рекорд впереди"), element("p", "", "Сыграй забег — он появится здесь"));
    body.append(empty);
  }
  const status = container.querySelector("[data-storage-status]");
  if (status !== null) status.textContent = history.storageAvailable
    ? "" : "Хранилище недоступно: результаты доступны только до закрытия страницы.";
}
