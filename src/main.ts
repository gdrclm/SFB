import "./styles.css";
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
  window.location.replace("about:blank");
}

restartButton.addEventListener("click", () => {
  void restartApplication();
});

void restartApplication();

window.addEventListener("pagehide", () => {
  lifecycle.dispose();
});

window.addEventListener("pageshow", (event) => {
  if (event.persisted) {
    void restartApplication();
  }
});
