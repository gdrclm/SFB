import type { RunHistory } from "./RunHistory";

export function renderRunHistory(container: HTMLElement, history: RunHistory): void {
  const best = history.personalBests();
  const summary = container.querySelector("[data-personal-bests]");
  if (summary !== null) summary.textContent = `Рекорды: глубина ${String(best.depth)} м · скорость ${best.maxSpeed.toFixed(1)} ед/с · этап ${best.stage === 0 ? "—" : String(best.stage)}`;
  const body = container.querySelector("[data-run-records]");
  if (body === null) return;
  body.replaceChildren();
  const records = history.top();
  for (const record of records) {
    const row = document.createElement("tr");
    const date = new Date(record.finishedAt).toLocaleString("ru-RU", {
      day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit",
    });
    for (const value of [date, String(record.score), `${String(record.depth)} м`, String(record.bestCombo ?? 0),
      record.outcome === "completed" ? "Завершён" : "Прерван"]) {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.append(cell);
    }
    body.append(row);
  }
  if (records.length === 0) {
    const cell = document.createElement("td");
    cell.colSpan = 5;
    cell.textContent = "Пока нет завершённых забегов";
    const row = document.createElement("tr");
    row.append(cell);
    body.append(row);
  }
  const status = container.querySelector("[data-storage-status]");
  if (status !== null) {
    status.textContent = history.storageAvailable
      ? "" : "Хранилище недоступно: результаты доступны только до закрытия страницы.";
  }
}
