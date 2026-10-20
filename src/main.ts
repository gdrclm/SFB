import { initializeFeedbackControls } from "./feedback/FeedbackControls";
import "./styles.css";
import { getBrowserRunHistory } from "./run/RunHistory";
import { renderRunHistory } from "./run/renderRunHistory";
import { hasFinishedOpening } from "./tutorial/StagedOpening";
import { ShopController } from "./shop/ShopController";
import { TutorialController } from "./app/TutorialController";
import { ApplicationLifecycle } from "./app/ApplicationLifecycle";
import { GameApplication } from "./app/GameApplication";

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
initializeFeedbackControls();
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
  renderRunHistory(startScreen, getBrowserRunHistory());
  shop.refreshBalance();
  startButton.focus();
}

restartButton.addEventListener("click", () => {
  void restartApplication();
});

const startScreen = requireElement("#start-screen");
const startButton = requireElement("#start-run-button");
if (!(startButton instanceof HTMLButtonElement)) {
  throw new TypeError("#start-run-button must be a button element.");
}
interfaceLayer.inert = true;
renderRunHistory(startScreen, getBrowserRunHistory());
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
