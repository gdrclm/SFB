import type { AbstractEngine } from "@babylonjs/core/Engines/abstractEngine";
import type { Scene } from "@babylonjs/core/scene";
import { createPauseMenuSummary, type MissionProgress } from "./PauseMenuModel";
import { BallController } from "../ball/BallController";
import { BallVisualController } from "../ball/BallVisualController";
import { createBallMesh } from "../ball/createBallMesh";
import { BoostButtonController } from "../boost/BoostButtonController";
import { BoostController } from "../boost/BoostController";
import { CameraController } from "../camera/CameraController";
import { CoinCollectionController } from "../coin/CoinCollectionController";
import { createCoins } from "../coin/CoinController";
import { CoinGenerator } from "../coin/CoinGenerator";
import { CollisionResolver, type PlatformCollision } from "../collision/CollisionResolver";
import { HavokPlatformSweep } from "../collision/HavokPlatformSweep";
import { SuccessfulPlatformHitHandler } from "../collision/SuccessfulPlatformHitHandler";
import { UnsuccessfulPlatformHitHandler } from "../collision/UnsuccessfulPlatformHitHandler";
import { gameConfig } from "../config/gameConfig";
import { FixedStepRunner } from "../core/FixedStepRunner";
import { GameState, GameStateController } from "../core/GameStateController";
import { RunWallet } from "../currency/RunWallet";
import { SuccessfulHitEffects } from "../effects/SuccessfulHitEffects";
import { UnsuccessfulHitEffects } from "../effects/UnsuccessfulHitEffects";
import { PointerHorizontalInput } from "../input/HorizontalInput";
import { PlatformGenerator } from "../platform/PlatformGenerator";
import type { PlatformController } from "../platform/PlatformController";
import { createStaticPlatformPool, type PlatformPool } from "../platform/PlatformPool";
import { createEngine, type RendererKind } from "../rendering/createEngine";
import "../rendering/registerStandardMaterialShaders";
import { PhaseOneController } from "../progression/PhaseOneController";
import { LifeCounter } from "../run/LifeCounter";
import { createMainScene } from "../scene/createMainScene";
import { SlowModeButtonController } from "../slow-mode/SlowModeButtonController";
import { SlowModeController } from "../slow-mode/SlowModeController";

function formatEnergy(energy: number): string {
  return String(Math.round(energy * 10) / 10);
}

const COIN_MISSION_TARGET = 50;
const PLATFORM_MISSION_TARGET = 10;
const SOUND_PREFERENCE_KEY = "speed-fall-ball.sound-enabled";
const INTERFACE_PREFERENCE_KEY = "speed-fall-ball.interface-visible";

export interface PauseMenuElements {
  readonly interfaceLayer: HTMLElement;
  readonly pauseButton: HTMLButtonElement;
  readonly menu: HTMLElement;
}

export interface GameApplicationActions {
  readonly restart: () => Promise<void>;
  readonly exit: () => void;
}

function requireMenuElement(menu: HTMLElement, selector: string): HTMLElement {
  const element = menu.querySelector<HTMLElement>(selector);
  if (element === null) {
    throw new Error(`Required pause-menu element not found: ${selector}`);
  }
  return element;
}

function requireMenuButton(
  menu: HTMLElement,
  selector: string,
): HTMLButtonElement {
  const element = requireMenuElement(menu, selector);
  if (!(element instanceof HTMLButtonElement)) {
    throw new TypeError(`Pause-menu element must be a button: ${selector}`);
  }
  return element;
}

function readBooleanPreference(key: string, fallback: boolean): boolean {
  try {
    const storedValue = window.localStorage.getItem(key);
    return storedValue === null ? fallback : storedValue === "true";
  } catch {
    return fallback;
  }
}

function writeBooleanPreference(key: string, value: boolean): void {
  try {
    window.localStorage.setItem(key, String(value));
  } catch {
    // The game remains usable when storage is unavailable.
  }
}

export class GameApplication {
  readonly #canvas: HTMLCanvasElement;
  readonly #status: HTMLElement;
  readonly #boostButtonElement: HTMLButtonElement;
  readonly #boostCostElement: HTMLElement;
  readonly #boostEnergyElement: HTMLElement;
  readonly #coinCountElement: HTMLElement;
  readonly #slowModeButtonElement: HTMLButtonElement;
  readonly #livesElement: HTMLElement;
  readonly #phaseStageElement: HTMLElement;
  readonly #speedValueElement: HTMLElement;
  readonly #breakthroughValueElement: HTMLElement;
  readonly #breakthroughHintElement: HTMLElement;
  readonly #depthValueElement: HTMLElement;
  readonly #gameOverElement: HTMLElement;
  readonly #interfaceLayerElement: HTMLElement;
  readonly #pauseButtonElement: HTMLButtonElement;
  readonly #pauseMenuElement: HTMLElement;
  readonly #pauseDepthElement: HTMLElement;
  readonly #pauseCoinElement: HTMLElement;
  readonly #missionCoinsValueElement: HTMLElement;
  readonly #missionCoinsProgressElement: HTMLElement;
  readonly #missionPlatformsValueElement: HTMLElement;
  readonly #missionPlatformsProgressElement: HTMLElement;
  readonly #missionStageValueElement: HTMLElement;
  readonly #missionStageProgressElement: HTMLElement;
  readonly #soundToggleElement: HTMLButtonElement;
  readonly #interfaceToggleElement: HTMLButtonElement;
  readonly #resumeButtonElement: HTMLButtonElement;
  readonly #pauseRestartButtonElement: HTMLButtonElement;
  readonly #exitButtonElement: HTMLButtonElement;
  readonly #actions: GameApplicationActions;
  readonly #gameState = new GameStateController();
  readonly #lives = new LifeCounter(gameConfig.run.initialLives);
  readonly #wallet = new RunWallet(
    gameConfig.economy.initialEnergy,
    gameConfig.economy.energyPerCoin,
  );
  readonly #fixedStep = new FixedStepRunner(
    gameConfig.simulation.fixedStepSeconds,
    gameConfig.simulation.maxFrameSeconds,
  );

  #engine: AbstractEngine | null = null;
  #scene: Scene | null = null;
  #horizontalInput: PointerHorizontalInput | null = null;
  #ballController: BallController | null = null;
  #ballVisualController: BallVisualController | null = null;
  #cameraController: CameraController | null = null;
  #boostController: BoostController | null = null;
  #boostButton: BoostButtonController | null = null;
  #coinCollectionController: CoinCollectionController | null = null;
  #coinGenerator: CoinGenerator | null = null;
  #slowModeController: SlowModeController | null = null;
  #slowModeButton: SlowModeButtonController | null = null;
  #platformPool: PlatformPool | null = null;
  #platformGenerator: PlatformGenerator | null = null;
  #phaseOneController: PhaseOneController | null = null;
  #collisionResolver: CollisionResolver | null = null;
  #successfulHitHandler: SuccessfulPlatformHitHandler | null = null;
  #successfulHitEffects: SuccessfulHitEffects | null = null;
  #unsuccessfulHitHandler: UnsuccessfulPlatformHitHandler | null = null;
  #unsuccessfulHitEffects: UnsuccessfulHitEffects | null = null;
  #unsubscribeCollision: (() => void) | null = null;
  #unsubscribeCoinCollected: (() => void) | null = null;
  #unsubscribePlatformGenerated: (() => void) | null = null;
  #unsubscribeBoosted: (() => void) | null = null;
  #unsubscribeStageChanged: (() => void) | null = null;
  #unsubscribePhaseCompleted: (() => void) | null = null;
  #lastFrameTimeMs = 0;
  #isDisposed = false;
  #resizeObserver: ResizeObserver | null = null;
  #stateBeforePause: GameState = GameState.Playing;
  #destroyedPlatformCount = 0;
  #soundEnabled = true;
  #interfaceVisible = true;

  public constructor(
    canvas: HTMLCanvasElement,
    status: HTMLElement,
    boostButton: HTMLButtonElement,
    boostCost: HTMLElement,
    boostEnergy: HTMLElement,
    coinCount: HTMLElement,
    slowModeButton: HTMLButtonElement,
    lives: HTMLElement,
    phaseStage: HTMLElement,
    speedValue: HTMLElement,
    breakthroughValue: HTMLElement,
    breakthroughHint: HTMLElement,
    depthValue: HTMLElement,
    gameOver: HTMLElement,
    pauseMenu: PauseMenuElements,
    actions: GameApplicationActions,
  ) {
    this.#canvas = canvas;
    this.#status = status;
    this.#boostButtonElement = boostButton;
    this.#boostCostElement = boostCost;
    this.#boostEnergyElement = boostEnergy;
    this.#coinCountElement = coinCount;
    this.#slowModeButtonElement = slowModeButton;
    this.#livesElement = lives;
    this.#phaseStageElement = phaseStage;
    this.#speedValueElement = speedValue;
    this.#breakthroughValueElement = breakthroughValue;
    this.#breakthroughHintElement = breakthroughHint;
    this.#depthValueElement = depthValue;
    this.#gameOverElement = gameOver;
    this.#interfaceLayerElement = pauseMenu.interfaceLayer;
    this.#pauseButtonElement = pauseMenu.pauseButton;
    this.#pauseMenuElement = pauseMenu.menu;
    this.#pauseDepthElement = requireMenuElement(pauseMenu.menu, "#pause-depth-value");
    this.#pauseCoinElement = requireMenuElement(pauseMenu.menu, "#pause-coin-value");
    this.#missionCoinsValueElement = requireMenuElement(pauseMenu.menu, "#mission-coins-value");
    this.#missionCoinsProgressElement = requireMenuElement(pauseMenu.menu, "#mission-coins-progress");
    this.#missionPlatformsValueElement = requireMenuElement(pauseMenu.menu, "#mission-platforms-value");
    this.#missionPlatformsProgressElement = requireMenuElement(pauseMenu.menu, "#mission-platforms-progress");
    this.#missionStageValueElement = requireMenuElement(pauseMenu.menu, "#mission-stage-value");
    this.#missionStageProgressElement = requireMenuElement(pauseMenu.menu, "#mission-stage-progress");
    this.#soundToggleElement = requireMenuButton(pauseMenu.menu, "#sound-toggle");
    this.#interfaceToggleElement = requireMenuButton(pauseMenu.menu, "#interface-toggle");
    this.#resumeButtonElement = requireMenuButton(pauseMenu.menu, "#resume-button");
    this.#pauseRestartButtonElement = requireMenuButton(pauseMenu.menu, "#pause-restart-button");
    this.#exitButtonElement = requireMenuButton(pauseMenu.menu, "#exit-button");
    this.#actions = actions;
    this.#soundEnabled = readBooleanPreference(SOUND_PREFERENCE_KEY, true);
    this.#interfaceVisible = readBooleanPreference(INTERFACE_PREFERENCE_KEY, true);
    this.#pauseMenuElement.hidden = true;
    this.#pauseButtonElement.disabled = true;
    this.#pauseButtonElement.setAttribute("aria-expanded", "false");
    this.#applySoundPreference();
    this.#applyInterfacePreference();
    this.#pauseButtonElement.addEventListener("click", this.#pauseGame);
    this.#resumeButtonElement.addEventListener("click", this.#resumeGame);
    this.#pauseRestartButtonElement.addEventListener("click", this.#restartGame);
    this.#exitButtonElement.addEventListener("click", this.#exitGame);
    this.#soundToggleElement.addEventListener("click", this.#toggleSound);
    this.#interfaceToggleElement.addEventListener("click", this.#toggleInterface);
    document.addEventListener("keydown", this.#handleKeyDown);
  }

  public async start(): Promise<void> {
    this.#gameOverElement.hidden = true;
    this.#renderLives();
    this.#renderCurrency();
    const { engine, renderer } = await createEngine(this.#canvas);
    if (this.#hasBeenDisposed()) {
      engine.dispose();
      return;
    }

    let mainScene: Awaited<ReturnType<typeof createMainScene>>;
    try {
      mainScene = await createMainScene(engine, gameConfig);
    } catch (error: unknown) {
      engine.dispose();
      throw error;
    }

    if (this.#hasBeenDisposed()) {
      mainScene.scene.dispose();
      engine.dispose();
      return;
    }

    this.#engine = engine;
    this.#scene = mainScene.scene;

    this.#horizontalInput = new PointerHorizontalInput(this.#canvas);
    const ballMesh = createBallMesh(this.#scene, gameConfig);
    this.#ballController = new BallController(ballMesh, this.#horizontalInput, gameConfig);
    this.#fixedStep.register(this.#ballController);
    this.#ballVisualController = new BallVisualController(
      ballMesh,
      this.#ballController,
      gameConfig,
    );
    this.#fixedStep.register(this.#ballVisualController);
    this.#cameraController = new CameraController(
      mainScene.camera,
      mainScene.cameraRig,
      this.#ballController,
      mainScene.getAspectRatio,
      gameConfig,
    );
    this.#fixedStep.register(this.#cameraController);
    const coins = createCoins(this.#scene, gameConfig);
    this.#coinCollectionController = new CoinCollectionController(
      this.#ballController,
      coins,
      this.#wallet,
      gameConfig,
    );
    this.#unsubscribeCoinCollected = this.#coinCollectionController.onCollected(
      this.#handleCoinCollected,
    );
    this.#fixedStep.register(this.#coinCollectionController);
    this.#coinGenerator = new CoinGenerator(
      this.#ballController,
      coins,
      gameConfig,
    );
    this.#fixedStep.register(this.#coinGenerator);
    this.#phaseOneController = new PhaseOneController(gameConfig);
    this.#unsubscribeStageChanged = this.#phaseOneController.onStageChanged(
      this.#handleStageChanged,
    );
    this.#unsubscribePhaseCompleted = this.#phaseOneController.onCompleted(
      this.#handlePhaseCompleted,
    );
    this.#renderPhaseStage();
    this.#fixedStep.register(this.#phaseOneController);
    this.#platformPool = createStaticPlatformPool(this.#scene, gameConfig);
    this.#platformGenerator = new PlatformGenerator(
      this.#ballController,
      this.#platformPool,
      this.#phaseOneController,
      gameConfig,
    );
    this.#unsubscribePlatformGenerated = this.#platformGenerator.onPlatformGenerated(
      (plan) => {
        this.#coinGenerator?.handlePlatformGenerated(plan);
      },
    );
    this.#fixedStep.register(this.#platformGenerator);
    this.#collisionResolver = new CollisionResolver(
      this.#ballController,
      new HavokPlatformSweep(
        this.#scene,
        mainScene.physicsPlugin,
        gameConfig.ball.radius,
        this.#platformPool.platforms,
      ),
    );
    this.#successfulHitEffects = new SuccessfulHitEffects(
      this.#scene,
      ballMesh,
      mainScene.camera,
      gameConfig,
    );
    this.#successfulHitHandler = new SuccessfulPlatformHitHandler(
      this.#ballController,
      this.#platformPool,
      this.#successfulHitEffects,
      gameConfig,
    );
    this.#unsuccessfulHitEffects = new UnsuccessfulHitEffects(
      ballMesh,
      mainScene.camera,
      gameConfig,
    );
    this.#unsuccessfulHitHandler = new UnsuccessfulPlatformHitHandler(
      this.#ballController,
      this.#gameState,
      this.#lives,
      this.#unsuccessfulHitEffects,
      gameConfig,
    );
    this.#unsubscribeCollision = this.#collisionResolver.onCollision(this.#handleCollision);
    this.#fixedStep.register(this.#collisionResolver);
    this.#fixedStep.register(this.#successfulHitEffects);
    this.#fixedStep.register(this.#unsuccessfulHitHandler);
    this.#fixedStep.register(this.#unsuccessfulHitEffects);
    this.#gameState.transitionTo(GameState.Playing);
    this.#pauseButtonElement.disabled = false;
    this.#slowModeController = new SlowModeController(
      this.#gameState,
      this.#wallet,
      gameConfig,
    );
    this.#slowModeButton = new SlowModeButtonController(
      this.#slowModeButtonElement,
      this.#slowModeController,
    );
    this.#boostController = new BoostController(
      this.#ballController,
      this.#gameState,
      this.#wallet,
      gameConfig,
    );
    this.#unsubscribeBoosted = this.#boostController.onBoosted((result) => {
      this.#ballVisualController?.playBoostReaction(result);
      this.#cameraController?.playBoostReaction();
    });
    this.#boostButton = new BoostButtonController(
      this.#boostButtonElement,
      this.#boostCostElement,
      this.#boostEnergyElement,
      this.#boostController,
    );
    this.#fixedStep.register(this.#boostController);
    this.#setStatus(renderer);

    window.addEventListener("resize", this.#resize);
    window.visualViewport?.addEventListener("resize", this.#resize);
    this.#resizeObserver = new ResizeObserver(this.#resize);
    this.#resizeObserver.observe(this.#canvas);
    this.#resize();
    this.#lastFrameTimeMs = performance.now();
    engine.runRenderLoop(this.#renderFrame);
  }

  public dispose(): void {
    this.#isDisposed = true;
    this.#pauseMenuElement.hidden = true;
    this.#pauseButtonElement.disabled = true;
    this.#pauseButtonElement.setAttribute("aria-expanded", "false");
    this.#pauseButtonElement.removeEventListener("click", this.#pauseGame);
    this.#resumeButtonElement.removeEventListener("click", this.#resumeGame);
    this.#pauseRestartButtonElement.removeEventListener("click", this.#restartGame);
    this.#exitButtonElement.removeEventListener("click", this.#exitGame);
    this.#soundToggleElement.removeEventListener("click", this.#toggleSound);
    this.#interfaceToggleElement.removeEventListener("click", this.#toggleInterface);
    document.removeEventListener("keydown", this.#handleKeyDown);
    window.removeEventListener("resize", this.#resize);
    window.visualViewport?.removeEventListener("resize", this.#resize);
    this.#resizeObserver?.disconnect();
    this.#resizeObserver = null;
    this.#engine?.stopRenderLoop(this.#renderFrame);
    if (this.#ballController !== null) {
      this.#fixedStep.unregister(this.#ballController);
    }
    if (this.#ballVisualController !== null) {
      this.#fixedStep.unregister(this.#ballVisualController);
    }
    if (this.#cameraController !== null) {
      this.#fixedStep.unregister(this.#cameraController);
    }
    if (this.#boostController !== null) {
      this.#fixedStep.unregister(this.#boostController);
    }
    if (this.#coinCollectionController !== null) {
      this.#fixedStep.unregister(this.#coinCollectionController);
    }
    if (this.#coinGenerator !== null) {
      this.#fixedStep.unregister(this.#coinGenerator);
    }
    if (this.#platformGenerator !== null) {
      this.#fixedStep.unregister(this.#platformGenerator);
    }
    if (this.#phaseOneController !== null) {
      this.#fixedStep.unregister(this.#phaseOneController);
    }
    if (this.#collisionResolver !== null) {
      this.#fixedStep.unregister(this.#collisionResolver);
    }
    if (this.#successfulHitEffects !== null) {
      this.#fixedStep.unregister(this.#successfulHitEffects);
    }
    if (this.#unsuccessfulHitHandler !== null) {
      this.#fixedStep.unregister(this.#unsuccessfulHitHandler);
    }
    if (this.#unsuccessfulHitEffects !== null) {
      this.#fixedStep.unregister(this.#unsuccessfulHitEffects);
    }
    this.#unsubscribeCollision?.();
    this.#unsubscribeCoinCollected?.();
    this.#unsubscribePlatformGenerated?.();
    this.#unsubscribeBoosted?.();
    this.#unsubscribeStageChanged?.();
    this.#unsubscribePhaseCompleted?.();
    this.#collisionResolver?.dispose();
    this.#coinCollectionController?.dispose();
    this.#successfulHitEffects?.dispose();
    this.#unsuccessfulHitEffects?.dispose();
    this.#ballVisualController?.dispose();
    this.#platformPool?.dispose();
    this.#boostButton?.dispose();
    this.#slowModeButton?.dispose();
    this.#horizontalInput?.dispose();
    this.#scene?.dispose();
    this.#engine?.dispose();
    this.#scene = null;
    this.#engine = null;
    this.#horizontalInput = null;
    this.#ballController = null;
    this.#ballVisualController = null;
    this.#cameraController = null;
    this.#boostController = null;
    this.#boostButton = null;
    this.#slowModeController = null;
    this.#slowModeButton = null;
    this.#coinCollectionController = null;
    this.#coinGenerator = null;
    this.#platformPool = null;
    this.#platformGenerator = null;
    this.#phaseOneController = null;
    this.#collisionResolver = null;
    this.#successfulHitHandler = null;
    this.#successfulHitEffects = null;
    this.#unsuccessfulHitHandler = null;
    this.#unsuccessfulHitEffects = null;
    this.#unsubscribeCollision = null;
    this.#unsubscribeCoinCollected = null;
    this.#unsubscribePlatformGenerated = null;
    this.#unsubscribeBoosted = null;
    this.#unsubscribeStageChanged = null;
    this.#unsubscribePhaseCompleted = null;
  }

  readonly #renderFrame = (): void => {
    const nowMs = performance.now();
    const realDeltaSeconds = (nowMs - this.#lastFrameTimeMs) / 1_000;
    const isPaused = this.#gameState.current === GameState.Paused;
    const timeScale = isPaused
      ? 1
      : (this.#slowModeController?.update(realDeltaSeconds) ?? 1);
    if (!isPaused && this.#gameState.current !== GameState.GameOver) {
      this.#fixedStep.advance(realDeltaSeconds, timeScale);
    }
    this.#lastFrameTimeMs = nowMs;
    this.#boostButton?.render();
    this.#slowModeButton?.render();
    this.#renderCurrency();
    this.#renderTelemetry();
    if (isPaused) {
      this.#renderPauseSummary();
    }
    this.#scene?.render();
  };

  readonly #resize = (): void => {
    this.#engine?.resize(true);
    this.#cameraController?.resizeViewport();
  };

  #setStatus(renderer: RendererKind): void {
    this.#status.textContent = `Сцена готова · ${renderer.toUpperCase()} · ${this.#gameState.current}`;
  }

  readonly #handleCollision = (collision: PlatformCollision): void => {
    const destroyed = this.#successfulHitHandler?.handle(collision) ?? false;
    const strength = collision.platform.strength.toFixed(1);
    if (destroyed && this.#ballController !== null) {
      this.#destroyedPlatformCount += 1;
      const platformEffect = this.#applyDestroyedPlatformEffect(
        collision.platform,
      );
      this.#status.textContent = `Платформа разрушена · скорость ${collision.ballSpeed.toFixed(1)} → ${this.#ballController.fallSpeed.toFixed(1)} · прочность ${strength}${platformEffect}`;
      return;
    }

    const bounced = this.#unsuccessfulHitHandler?.handle(collision) ?? false;
    if (bounced) {
      this.#renderLives();
      if (this.#gameState.current === GameState.GameOver) {
        this.#status.textContent = "Забег завершён · все жизни потеряны";
        this.#pauseButtonElement.disabled = true;
        this.#gameOverElement.hidden = false;
        return;
      }

      this.#status.textContent = `Ошибка · отскок · скорость ${collision.ballSpeed.toFixed(1)} ниже прочности ${strength} · сброс до ${gameConfig.ball.startFallSpeed.toFixed(1)}`;
      return;
    }

    this.#status.textContent = `Столкновение · скорость ${collision.ballSpeed.toFixed(1)} · прочность ${strength} · недостаточно`;
  };

  readonly #handleCoinCollected = (): void => {
    this.#renderCurrency();
    this.#renderTelemetry();
    this.#status.textContent = `Монета собрана · +${String(gameConfig.economy.speedPerCoin)} к скорости · монеты ${String(this.#wallet.coins)} · энергия ${String(this.#wallet.energy)}`;
  };

  #applyDestroyedPlatformEffect(platform: PlatformController): string {
    if (platform.kind === "vitality") {
      const restoredLives = this.#lives.restoreLives(
        gameConfig.platformEffects.vitalityLives,
      );
      this.#wallet.addEnergy(gameConfig.platformEffects.vitalityEnergy);
      this.#renderLives();
      this.#renderCurrency();
      const lifeStatus =
        restoredLives > 0
          ? `+${String(restoredLives)} жизнь`
          : "здоровье полное";
      return ` · зелёная: ${lifeStatus}, +${String(gameConfig.platformEffects.vitalityEnergy)} энергии`;
    }

    if (platform.kind === "time-slow") {
      this.#slowModeController?.forceStart(
        gameConfig.platformEffects.forcedSlowDurationRealSeconds,
      );
      this.#slowModeButton?.render();
      return ` · белая: замедление ${String(gameConfig.platformEffects.forcedSlowDurationRealSeconds)} сек`;
    }

    return platform.kind === "super-heavy" ? " · чёрная сверхтяжёлая" : "";
  }

  readonly #handleStageChanged = (stageNumber: number): void => {
    this.#renderPhaseStage();
    this.#status.textContent = `Первая фаза · этап ${String(stageNumber)} из ${String(gameConfig.phaseOne.stages.length)}`;
  };

  readonly #handlePhaseCompleted = (): void => {
    this.#renderPhaseStage();
    this.#status.textContent = "Первая фаза пройдена";
  };

  #hasBeenDisposed(): boolean {
    return this.#isDisposed;
  }

  #renderLives(): void {
    const remainingLives = this.#lives.remainingLives;
    const hearts: HTMLSpanElement[] = [];
    for (let index = 0; index < gameConfig.run.initialLives; index += 1) {
      const heart = document.createElement("span");
      heart.className =
        index < remainingLives ? "life-heart" : "life-heart life-lost";
      heart.textContent = "♥";
      heart.setAttribute("aria-hidden", "true");
      hearts.push(heart);
    }
    this.#livesElement.replaceChildren(...hearts);
    this.#livesElement.setAttribute(
      "aria-label",
      `Жизни: ${String(remainingLives)} из ${String(gameConfig.run.initialLives)}`,
    );
  }

  #renderCurrency(): void {
    const energy = formatEnergy(this.#wallet.energy);
    this.#coinCountElement.textContent = String(this.#wallet.coins);
    this.#coinCountElement.setAttribute(
      "aria-label",
      `Монеты: ${String(this.#wallet.coins)}`,
    );
    this.#boostEnergyElement.textContent = energy;
    this.#boostEnergyElement.setAttribute(
      "aria-label",
      `Энергия: ${energy}`,
    );
  }

  #renderPhaseStage(): void {
    const phase = this.#phaseOneController;
    if (phase === null) {
      this.#phaseStageElement.textContent = "Этап —/10";
      return;
    }

    this.#phaseStageElement.textContent = phase.isComplete
      ? "Фаза 1 пройдена"
      : `ЭТАП ${String(phase.currentStageNumber)}/${String(gameConfig.phaseOne.stages.length)}`;
    this.#phaseStageElement.setAttribute(
      "aria-label",
      phase.isComplete
        ? "Первая фаза пройдена"
        : `Первая фаза, этап ${String(phase.currentStageNumber)} из ${String(gameConfig.phaseOne.stages.length)}`,
    );
  }

  #renderTelemetry(): void {
    const ball = this.#ballController;
    if (ball === null) {
      this.#speedValueElement.textContent = "0";
      this.#breakthroughValueElement.textContent = "0";
      this.#breakthroughHintElement.textContent = "0";
      this.#depthValueElement.textContent = "0 М";
      return;
    }

    const speed = Math.max(0, ball.fallSpeed);
    const breakthrough = Math.floor(speed);
    const depth = Math.max(
      0,
      gameConfig.ball.startPosition.y - ball.position.y,
    );
    this.#speedValueElement.textContent = speed.toFixed(1);
    this.#breakthroughValueElement.textContent = String(breakthrough);
    this.#breakthroughHintElement.textContent = String(breakthrough);
    this.#depthValueElement.textContent = `${depth.toFixed(0)} М`;
  }

  readonly #pauseGame = (): void => {
    const currentState = this.#gameState.current;
    if (
      currentState === GameState.Loading ||
      currentState === GameState.Paused ||
      currentState === GameState.GameOver ||
      currentState === GameState.Results
    ) {
      return;
    }

    this.#stateBeforePause = currentState;
    this.#gameState.transitionTo(GameState.Paused);
    this.#pauseMenuElement.hidden = false;
    this.#pauseButtonElement.setAttribute("aria-label", "Игра на паузе");
    this.#pauseButtonElement.setAttribute("aria-expanded", "true");
    this.#renderPauseSummary();
    this.#resumeButtonElement.focus();
  };

  readonly #resumeGame = (): void => {
    if (this.#gameState.current !== GameState.Paused) {
      return;
    }

    this.#gameState.transitionTo(this.#stateBeforePause);
    this.#pauseMenuElement.hidden = true;
    this.#pauseButtonElement.setAttribute("aria-label", "Открыть меню паузы");
    this.#pauseButtonElement.setAttribute("aria-expanded", "false");
    this.#pauseButtonElement.focus();
  };

  readonly #restartGame = (): void => {
    this.#pauseRestartButtonElement.disabled = true;
    void this.#actions.restart().finally(() => {
      this.#pauseRestartButtonElement.disabled = false;
    });
  };

  readonly #exitGame = (): void => {
    this.#actions.exit();
  };

  readonly #toggleSound = (): void => {
    this.#soundEnabled = !this.#soundEnabled;
    writeBooleanPreference(SOUND_PREFERENCE_KEY, this.#soundEnabled);
    this.#applySoundPreference();
  };

  readonly #toggleInterface = (): void => {
    this.#interfaceVisible = !this.#interfaceVisible;
    writeBooleanPreference(INTERFACE_PREFERENCE_KEY, this.#interfaceVisible);
    this.#applyInterfacePreference();
  };

  readonly #handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key === "Tab" && this.#gameState.current === GameState.Paused) {
      this.#keepFocusInsidePauseMenu(event);
      return;
    }

    if (event.key !== "Escape") {
      return;
    }

    event.preventDefault();
    if (this.#gameState.current === GameState.Paused) {
      this.#resumeGame();
    } else {
      this.#pauseGame();
    }
  };

  #applySoundPreference(): void {
    document.documentElement.dataset.soundEnabled = String(this.#soundEnabled);
    for (const mediaElement of document.querySelectorAll<HTMLMediaElement>("audio, video")) {
      mediaElement.muted = !this.#soundEnabled;
    }
    this.#renderSettingState(this.#soundToggleElement, this.#soundEnabled);
  }

  #applyInterfacePreference(): void {
    this.#interfaceLayerElement.classList.toggle(
      "game-hud-hidden",
      !this.#interfaceVisible,
    );
    this.#renderSettingState(this.#interfaceToggleElement, this.#interfaceVisible);
  }

  #renderSettingState(button: HTMLButtonElement, enabled: boolean): void {
    button.setAttribute("aria-pressed", String(enabled));
    const state = button.querySelector<HTMLElement>(".setting-state");
    if (state !== null) {
      state.textContent = enabled ? "ВКЛ" : "ВЫКЛ";
    }
  }

  #renderPauseSummary(): void {
    const summary = createPauseMenuSummary({
      depth: this.#getDepth(),
      coins: this.#wallet.coins,
      destroyedPlatforms: this.#destroyedPlatformCount,
      stage: this.#phaseOneController?.currentStageNumber ?? 1,
      stageTarget: gameConfig.phaseOne.stages.length,
      coinTarget: COIN_MISSION_TARGET,
      platformTarget: PLATFORM_MISSION_TARGET,
    });

    this.#pauseDepthElement.textContent = summary.depthLabel;
    this.#pauseCoinElement.textContent = summary.coinLabel;
    this.#renderMissionProgress(
      this.#missionCoinsValueElement,
      this.#missionCoinsProgressElement,
      summary.coinsMission,
    );
    this.#renderMissionProgress(
      this.#missionPlatformsValueElement,
      this.#missionPlatformsProgressElement,
      summary.platformsMission,
    );
    this.#renderMissionProgress(
      this.#missionStageValueElement,
      this.#missionStageProgressElement,
      summary.stageMission,
    );
  }

  #renderMissionProgress(
    valueElement: HTMLElement,
    progressElement: HTMLElement,
    progress: MissionProgress,
  ): void {
    valueElement.textContent = progress.label;
    progressElement.style.transform = `scaleX(${String(progress.ratio)})`;
  }

  #keepFocusInsidePauseMenu(event: KeyboardEvent): void {
    const focusableElements = Array.from(
      this.#pauseMenuElement.querySelectorAll<HTMLButtonElement>(
        "button:not(:disabled)",
      ),
    );
    if (focusableElements.length === 0) {
      event.preventDefault();
      return;
    }

    const firstElement = focusableElements[0];
    const lastElement = focusableElements.at(-1);
    if (firstElement === undefined || lastElement === undefined) {
      return;
    }

    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
    } else if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  }

  #getDepth(): number {
    const ball = this.#ballController;
    return ball === null
      ? 0
      : Math.max(0, gameConfig.ball.startPosition.y - ball.position.y);
  }
}
