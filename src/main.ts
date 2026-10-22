import { DEVELOPER_MODE_KEY, DEVELOPER_DEPTH_KEY, parseStartDepth } from "./dev/DeveloperMode";
import { NetworkView } from "./network/NetworkView";
import type { RunTicket } from "./network/types";
import { initializeHudArt } from "./ui/HudArt";
import { getGameSounds } from "./feedback/GameSounds";
import { initializeFeedbackControls } from "./feedback/FeedbackControls";
import "./styles.css";
import { getBrowserRunHistory } from "./run/RunHistory";
import { renderRunHistory } from "./run/renderRunHistory";
import { hasFinishedOpening } from "./tutorial/StagedOpening";
import { ShopController } from "./shop/ShopController";
import { TutorialController } from "./app/TutorialController";
import { ApplicationLifecycle } from "./app/ApplicationLifecycle";
import { GameApplication } from "./app/GameApplication";
import { getPlayerProfile } from "./shop/PlayerProfile";
import { renderMissionBoard } from "./run/renderMissionBoard";
import { resetGameData } from "./storage/resetGameData";

function requireElement(selector: string): HTMLElement {
  const element = document.querySelector<HTMLElement>(selector);
  if (element === null) {
    throw new Error(`Required element not found: ${selector}`);
  }
  return element;
}

const canvasElement = requireElement("#game-canvas");
if (!(canvasElement instanceof HTMLCanvasElement)) {
  throw new TypeError("#game-canvas must be a canvas element.");
}

const canvas = canvasElement;
const status = requireElement("#status");
const boostButtonElement = requireElement("#boost-button");
if (!(boostButtonElement instanceof HTMLButtonElement)) {
  throw new TypeError("#boost-button must be a button element.");
}
const boostCost = requireElement("#boost-cost");
const boostEnergy = requireElement("#boost-energy");
const coinCount = requireElement("#coin-count");
const slowModeButtonElement = requireElement("#slow-mode-button");
if (!(slowModeButtonElement instanceof HTMLButtonElement)) {
  throw new TypeError("#slow-mode-button must be a button element.");
}
const lives = requireElement("#lives");
const phaseStage = requireElement("#phase-stage");
const speedValue = requireElement("#speed-value");
const breakthroughValue = requireElement("#breakthrough-value");
const breakthroughHint = requireElement("#breakthrough-hint");
const depthValue = requireElement("#depth-value");
const gameOver = requireElement("#game-over");
const interfaceLayer = requireElement("#interface-layer");
const pauseMenu = requireElement("#pause-menu");
const pauseButtonElement = requireElement("#pause-button");
if (!(pauseButtonElement instanceof HTMLButtonElement)) {
  throw new TypeError("#pause-button must be a button element.");
}
const restartButtonElement = requireElement("#restart-button");
if (!(restartButtonElement instanceof HTMLButtonElement)) {
  throw new TypeError("#restart-button must be a button element.");
}
const restartButton = restartButtonElement;
initializeHudArt();
initializeFeedbackControls();
getGameSounds();
const network = new NetworkView();
let requestedGuidedRun = false;
let requestedRanked = false;
let requestedDeveloperDepth: number | undefined;
let activeTicket: RunTicket | null = null;
const lifecycle = new ApplicationLifecycle(
  () => { return new GameApplication(
    canvas,
    status,
    boostButtonElement,
    boostCost,
    boostEnergy,
    coinCount,
    slowModeButtonElement,
    lives,
    phaseStage,
    speedValue,
    breakthroughValue,
    breakthroughHint,
    depthValue,
    gameOver,
    {
      interfaceLayer,
      pauseButton: pauseButtonElement,
      menu: pauseMenu,
    },
    {
      guided: requestedDeveloperDepth === undefined && !requestedRanked && (requestedGuidedRun || !hasFinishedOpening()),
      developerStartDepth: requestedDeveloperDepth,
      ranked: requestedRanked,
      onFinished: (result, durationMs) => { const ticket = activeTicket; if (ticket !== null) network.online.enqueue({ticket,result,durationMs}); },
      restart: restartApplication,
      exit: exitApplication,
    },
  ); },
);

function showStartupError(error: unknown): void {
  lifecycle.dispose();
  const message = error instanceof Error ? error.message : "Unknown startup error";
  status.textContent = `Ошибка запуска: ${message}`;
  requireElement("#start-error").textContent = status.textContent;
  requireElement("#start-screen").hidden = false;
  interfaceLayer.inert = true;
  console.error(error);
}

async function restartApplication(): Promise<void> {
  requestedGuidedRun = false;
  restartButton.disabled = true;
  try {
    activeTicket = requestedRanked ? await network.beginRun() : null;
    await lifecycle.restart();
  } catch (error: unknown) {
    showStartupError(error);
  } finally {
    restartButton.disabled = false;
  }
}

function exitApplication(): void {
  lifecycle.dispose();
  startScreen.hidden = false;
  network.showMenu();
  interfaceLayer.inert = true;
  requireElement("#start-error").textContent = "";
  shop.refreshBalance();
  renderMissionBoard(missionsDialog, getPlayerProfile());
  startButton.focus({ preventScroll: true });
}

restartButton.addEventListener("click", () => {
  void restartApplication();
});

const startScreen = requireElement("#start-screen");
const missionsDialog = requireElement("#missions-dialog");
if (!(missionsDialog instanceof HTMLDialogElement)) throw new TypeError("#missions-dialog must be a dialog.");
requireElement("#missions-button").addEventListener("click", () => {
  renderMissionBoard(missionsDialog, getPlayerProfile());
  missionsDialog.showModal();
});
requireElement("#missions-close").addEventListener("click", () => { missionsDialog.close(); });
renderMissionBoard(missionsDialog, getPlayerProfile());
requireElement("#next-missions-button").addEventListener("click", () => {
  const saved = getPlayerProfile().nextMissionBoard();
  renderMissionBoard(missionsDialog, getPlayerProfile());
  const error = requireElement("#mission-error");
  error.hidden = saved;
  error.textContent = saved ? "" : "Не удалось сохранить задания.";
});
const startButton = requireElement("#start-run-button");
if (!(startButton instanceof HTMLButtonElement)) {
  throw new TypeError("#start-run-button must be a button element.");
}
interfaceLayer.inert = true;
const settingsDialog = requireElement("#game-settings");
if (!(settingsDialog instanceof HTMLDialogElement)) throw new TypeError("#game-settings must be a dialog.");
for (const button of document.querySelectorAll<HTMLButtonElement>("[data-open-settings]")) {
  button.addEventListener("click", () => {
    requireElement("#interface-toggle").hidden = !startScreen.hidden;
    settingsDialog.showModal();
  });
}
requireElement("#settings-close").addEventListener("click", () => { settingsDialog.close(); });
const resetDialog = requireElement("#reset-data-dialog");
if (!(resetDialog instanceof HTMLDialogElement)) throw new TypeError("#reset-data-dialog must be a dialog.");
requireElement("#reset-data-button").addEventListener("click", () => {
  requireElement("#reset-data-error").hidden = true;
  resetDialog.showModal();
  requireElement("#reset-data-cancel").focus({ preventScroll: true });
});
requireElement("#reset-data-cancel").addEventListener("click", () => { resetDialog.close(); });
requireElement("#reset-data-confirm").addEventListener("click", () => {
  try {
    // Disposing may save an interrupted run: finish it BEFORE clearing storage.
    lifecycle.dispose();
    resetGameData(window.localStorage);
    window.location.reload();
  } catch {
    exitApplication();
    const error = requireElement("#reset-data-error");
    error.hidden = false;
    error.textContent = "Не удалось сбросить данные. Проверь доступ браузера к хранилищу и попробуй ещё раз.";
  }
});
const recordsDialog = requireElement("#records");
if (!(recordsDialog instanceof HTMLDialogElement)) throw new TypeError("#records must be a dialog.");
for (const button of document.querySelectorAll<HTMLButtonElement>("[data-open-records]")) {
  button.addEventListener("click", () => {
    renderRunHistory(recordsDialog, getBrowserRunHistory());
    recordsDialog.showModal();
    network.openRecords();
  });
}
requireElement("#records-close").addEventListener("click", () => { recordsDialog.close(); });
const shopDialog = requireElement("#shop");
if (!(shopDialog instanceof HTMLDialogElement)) throw new TypeError("#shop must be a dialog.");
const shop = new ShopController(shopDialog);
shop.refreshBalance();
requireElement("#shop-button").addEventListener("click", () => { shop.open(); });
requireElement("#results-menu-button").addEventListener("click", exitApplication);
const tutorialDialog = requireElement("#tutorial");
if (!(tutorialDialog instanceof HTMLDialogElement)) throw new TypeError("#tutorial must be a dialog.");
const tutorial = new TutorialController(tutorialDialog);
for (const button of document.querySelectorAll<HTMLButtonElement>("[data-open-tutorial]")) {
  button.addEventListener("click", () => { tutorial.open(); });
}
function requireInput(selector: string): HTMLInputElement {
  const input = requireElement(selector);
  if (!(input instanceof HTMLInputElement)) throw new TypeError(`${selector} must be an input.`);
  return input;
}
const developerToggle = requireInput("#developer-mode");
const developerDepth = requireInput("#developer-depth");
try {
  developerToggle.checked = localStorage.getItem(DEVELOPER_MODE_KEY) === "true";
  developerDepth.value = String(parseStartDepth(localStorage.getItem(DEVELOPER_DEPTH_KEY) ?? "0") ?? 0);
} catch { /* Settings remain usable without storage. */ }
function renderDeveloperMode(): void {
  requireElement("#developer-start").hidden = !developerToggle.checked;
  requireElement("#guided-run-button").hidden = developerToggle.checked;
  document.body.dataset.developerMode = String(developerToggle.checked);
}
developerToggle.addEventListener("change", () => {
  try { localStorage.setItem(DEVELOPER_MODE_KEY, String(developerToggle.checked)); } catch { /* Session setting. */ }
  renderDeveloperMode();
});
developerDepth.addEventListener("input", () => { developerDepth.setCustomValidity(""); });
renderDeveloperMode();

const startRun = (guided = !network.wantsRanked && !hasFinishedOpening()): void => {
  if (startButton.disabled) return;
  const depth = parseStartDepth(developerDepth.value);
  if (developerToggle.checked && depth === null) {
    developerDepth.setCustomValidity("Введи целое число от 0 до 1 000 000.");
    developerDepth.reportValidity();
    return;
  }
  requestedDeveloperDepth = developerToggle.checked ? depth ?? 0 : undefined;
  if (requestedDeveloperDepth !== undefined) {
    try { localStorage.setItem(DEVELOPER_DEPTH_KEY, String(requestedDeveloperDepth)); } catch { /* Session setting. */ }
  }
  requestedGuidedRun = requestedDeveloperDepth === undefined && guided;
  requestedRanked = requestedDeveloperDepth === undefined && network.wantsRanked && !guided;
  startButton.disabled = true;
  requireElement("#start-error").textContent = "Загрузка…";
  void (async () => {
    activeTicket = requestedRanked ? await network.beginRun() : null;
    await lifecycle.restart();
  })().then(() => {
    requestedGuidedRun = false;
    startScreen.hidden = true;
    interfaceLayer.inert = false;
    canvas.focus({ preventScroll: true });
  }).catch((error: unknown) => {
    showStartupError(error);
    requireElement("#start-error").textContent = status.textContent;
  }).finally(() => {
    startButton.disabled = false;
  });
};
startButton.addEventListener("click", () => { startRun(); });
requireElement("#guided-run-button").addEventListener("click", () => { startRun(true); });
startButton.focus({ preventScroll: true });

window.addEventListener("pagehide", () => {
  lifecycle.dispose();
});

window.addEventListener("pageshow", (event) => {
  if (event.persisted && startScreen.hidden) {
    void restartApplication();
  }
});

const numbersToggle = document.querySelector<HTMLButtonElement>("#platform-numbers-toggle");
let showPlatformNumbers = false;
try { showPlatformNumbers = localStorage.getItem("speed-fall-ball.platform-numbers") === "true"; } catch { /* Use visual cues. */ }
function applyPlatformNumbers(): void {
  document.body.dataset.platformNumbers = String(showPlatformNumbers);
  numbersToggle?.setAttribute("aria-pressed", String(showPlatformNumbers));
  if (numbersToggle !== null) numbersToggle.textContent = `Числа прочности: ${showPlatformNumbers ? "вкл." : "выкл."}`;
}
numbersToggle?.addEventListener("click", () => {
  showPlatformNumbers = !showPlatformNumbers;
  try { localStorage.setItem("speed-fall-ball.platform-numbers", String(showPlatformNumbers)); } catch { /* Session choice. */ }
  applyPlatformNumbers();
});
applyPlatformNumbers();
