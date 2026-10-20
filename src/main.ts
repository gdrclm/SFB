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
let requestedGuidedRun = false;
const lifecycle = new ApplicationLifecycle(
  () => new GameApplication(
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
      guided: requestedGuidedRun || !hasFinishedOpening(),
      restart: restartApplication,
      exit: exitApplication,
    },
  ),
);

function showStartupError(error: unknown): void {
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
  interfaceLayer.inert = true;
  requireElement("#start-error").textContent = "";
  shop.refreshBalance();
  renderMissionBoard(missionsDialog, getPlayerProfile());
  startButton.focus();
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
const recordsDialog = requireElement("#records");
if (!(recordsDialog instanceof HTMLDialogElement)) throw new TypeError("#records must be a dialog.");
for (const button of document.querySelectorAll<HTMLButtonElement>("[data-open-records]")) {
  button.addEventListener("click", () => {
    renderRunHistory(recordsDialog, getBrowserRunHistory());
    recordsDialog.showModal();
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
const startRun = (guided = !hasFinishedOpening()): void => {
  if (startButton.disabled) return;
  requestedGuidedRun = guided;
  startButton.disabled = true;
  requireElement("#start-error").textContent = "Загрузка…";
  void lifecycle.restart().then(() => {
    requestedGuidedRun = false;
    startScreen.hidden = true;
    interfaceLayer.inert = false;
    canvas.focus();
  }).catch((error: unknown) => {
    showStartupError(error);
    requireElement("#start-error").textContent = status.textContent;
  }).finally(() => {
    startButton.disabled = false;
  });
};
startButton.addEventListener("click", () => { startRun(); });
requireElement("#guided-run-button").addEventListener("click", () => { startRun(true); });
startButton.focus();

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
