import type { PlayerProfile } from "../shop/PlayerProfile";
import { currentMission, MISSION_REWARD } from "./Missions";

/** Selection is offered in the main menu only; a run keeps its selected goal. */
export function renderMissionBoard(root: HTMLElement, profile: PlayerProfile): void {
  const list = root.querySelector<HTMLElement>("#mission-list");
  if (list === null) return;
  const board = profile.missionBoard;
  const focusedIndex = document.activeElement instanceof HTMLElement ? document.activeElement.dataset.missionIndex : undefined;
  const buttons = board.progress.map((progress, offset) => {
    const index = board.start + offset;
    const mission = currentMission({ index, progress });
    const complete = board.completed[offset] === true;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "mission-choice";
    button.dataset.missionIndex = String(index);
    button.dataset.complete = String(complete);
    button.setAttribute("aria-pressed", String(board.selected === offset && !complete));
    button.disabled = complete;
    const icon = document.createElement("span");
    icon.className = "mission-choice-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = complete ? "✓" : ["◇", "★", "ϟ", "▰", "×"][offset] ?? "◇";
    const title = document.createElement("span");
    title.className = "mission-choice-title";
    title.textContent = mission.title;
    const detail = document.createElement("small");
    detail.textContent = complete ? "Выполнено" : `${String(progress)}/${String(mission.target)} · +${String(MISSION_REWARD)} ★`;
    button.append(icon, title, detail);
    button.addEventListener("click", () => {
      const saved = profile.selectMission(index);
      renderMissionBoard(root, profile);
      const error = root.querySelector<HTMLElement>("#mission-error");
      if (error !== null) { error.hidden = saved; error.textContent = saved ? "" : "Не удалось сохранить выбор."; }
    });
    return button;
  });
  list.replaceChildren(...buttons);
  const next = root.querySelector<HTMLButtonElement>("#next-missions-button");
  if (next !== null) next.hidden = !board.completed.every(Boolean);
  if (focusedIndex !== undefined) list.querySelector<HTMLButtonElement>(`[data-mission-index="${focusedIndex}"]`)?.focus({ preventScroll: true });
}

export function renderPinnedMission(root: HTMLElement, profile: PlayerProfile): void {
  const panel = root.querySelector<HTMLElement>("#pause-mission");
  if (panel === null) return;
  const state = profile.activeMission;
  panel.hidden = state === null;
  if (state === null) { panel.replaceChildren(); return; }
  const mission = currentMission(state);
  const title = document.createElement("strong");
  title.textContent = mission.title;
  const progress = document.createElement("span");
  progress.textContent = `${String(state.progress)}/${String(mission.target)} · +${String(MISSION_REWARD)} ★`;
  panel.replaceChildren(title, progress);
}
