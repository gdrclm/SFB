import { hudArt } from "../ui/HudArt";
import { DepthBackdrop } from "../scene/DepthBackdrop";
import { GameFeel } from "../feedback/GameFeel";
import { getGameSounds } from "../feedback/GameSounds";
import { ChallengeDirector } from "../challenges/ChallengeDirector";
import { BoostCoach } from "../boost/BoostCoach";
import { describeFailedImpact } from "../run/FailedImpact";
import { tutorialVisuals as tutorialArt } from "./TutorialController";
import { currentMission, MISSION_REWARD, type MissionEvent } from "../run/Missions";
import { renderPinnedMission } from "../run/renderMissionBoard";
import { waitForPlatformSprites } from "../platform/PlatformSprites";
import { advanceIdleTime } from "../platform/PlatformIdle";
import { setPlatformCrystalBlend } from "../platform/PlatformCrystalSkin";
import { RunSceneResources } from "../scene/RunSceneResources";
import { getHaptics } from "../feedback/Haptics";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { ContextGuide } from "../tutorial/ContextGuide";
import { saveFinishedOpening, StagedOpening } from "../tutorial/StagedOpening";
import type { AbstractEngine } from "@babylonjs/core/Engines/abstractEngine";
import type { Scene } from "@babylonjs/core/scene";
import { ComboController } from "../combo/ComboController";
import { ComboView } from "../combo/ComboView";
import { BallController } from "../ball/BallController";
import { BallVisualController } from "../ball/BallVisualController";
import { createBallMesh } from "../ball/createBallMesh";
import { BoostButtonController } from "../boost/BoostButtonController";
import { SpeedFeedback } from "../boost/SpeedFeedback";
import { BoostController } from "../boost/BoostController";
import { CameraController } from "../camera/CameraController";
import { CoinCollectionController } from "../coin/CoinCollectionController";
import { createCoins, type CoinController } from "../coin/CoinController";
import { CoinGenerator } from "../coin/CoinGenerator";
import { CollisionResolver, type PlatformCollision } from "../collision/CollisionResolver";
import { HavokPlatformSweep } from "../collision/HavokPlatformSweep";
import { SuccessfulPlatformHitHandler } from "../collision/SuccessfulPlatformHitHandler";
import { UnsuccessfulPlatformHitHandler } from "../collision/UnsuccessfulPlatformHitHandler";
import { createPlayerConfig, getPlayerProfile } from "../shop/PlayerProfile";
import { gameConfig as defaultGameConfig } from "../config/gameConfig";
import { FixedStepRunner } from "../core/FixedStepRunner";
import { GameState, GameStateController } from "../core/GameStateController";
import { RunWallet } from "../currency/RunWallet";
import { SuccessfulHitEffects } from "../effects/SuccessfulHitEffects";
import { UnsuccessfulHitEffects } from "../effects/UnsuccessfulHitEffects";
import { PointerHorizontalInput } from "../input/HorizontalInput";
import { PlatformLabels } from "../platform/PlatformLabels";
import { nearestInCurrentLane } from "../platform/PlatformReadability";
import { PlatformGenerator } from "../platform/PlatformGenerator";
import type { PlatformController } from "../platform/PlatformController";
import { createStaticPlatformPool, type PlatformPool } from "../platform/PlatformPool";
import { createEngine, type RendererKind } from "../rendering/createEngine";
import "../rendering/registerStandardMaterialShaders";
import { PhaseOneController } from "../progression/PhaseOneController";
import { calculateScore, getBrowserRunHistory, RunProgress } from "../run/RunHistory";
import { LifeCounter } from "../run/LifeCounter";
import { createMainScene } from "../scene/createMainScene";
import { SlowModeButtonController } from "../slow-mode/SlowModeButtonController";
import { SlowModeController } from "../slow-mode/SlowModeController";

function formatEnergy(energy: number): string {
  return String(Math.round(energy * 10) / 10);
}

const INTERFACE_PREFERENCE_KEY = "speed-fall-ball.interface-visible";

export interface PauseMenuElements {
  readonly interfaceLayer: HTMLElement;
  readonly pauseButton: HTMLButtonElement;
  readonly menu: HTMLElement;
}

export interface GameApplicationActions {
  readonly guided?: boolean;
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
  readonly #haptics = getHaptics();
  #recordHapticTimer: ReturnType<typeof setTimeout> | null = null;
  #recordCelebrated = false;
  readonly #profile = getPlayerProfile();
  readonly #config = createPlayerConfig(defaultGameConfig, this.#profile);
  readonly #history = getBrowserRunHistory();
  #runProgress = new RunProgress();
  #combo = new ComboController();
  #comboView: ComboView | null = null;
  #feel: GameFeel | null = null;
  #backdrop: DepthBackdrop | null = null;
  #elapsedPlatformSeconds = 0;
  #opening: StagedOpening | null = null;
  #guideStrengths: number[] = [];
  #contextGuide: ContextGuide | null = null;
  readonly #reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  #runStarted = false;
  #challengeDirector: ChallengeDirector | null = null;
  #challengeRemaining = 0;
  #boostCoach = new BoostCoach();
  #hitStopRemaining = 0;
  #lastDepthCheckpoint = 0;
  #energyHighWater = this.#config.economy.initialEnergy;
  #missionIntroRemaining = 0;
  #lastLifeCount = this.#config.run.initialLives;
  #missionRewardRemaining = 0;
  #missionSaveFailed = false;
  #mainScene: Awaited<ReturnType<typeof createMainScene>> | null = null;
  #runResources: RunSceneResources | null = null;
  #renderer: RendererKind = "webgl2";
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
  readonly #interfaceToggleElement: HTMLButtonElement;
  readonly #resumeButtonElement: HTMLButtonElement;
  readonly #pauseRestartButtonElement: HTMLButtonElement;
  readonly #exitButtonElement: HTMLButtonElement;
  readonly #actions: GameApplicationActions;
  #gameState = new GameStateController();
  #lives = new LifeCounter(this.#config.run.initialLives);
  #wallet = new RunWallet(
    this.#config.economy.initialEnergy,
    this.#config.economy.energyPerCoin,
  );
  #fixedStep = new FixedStepRunner(
    this.#config.simulation.fixedStepSeconds,
    this.#config.simulation.maxFrameSeconds,
  );

  #engine: AbstractEngine | null = null;
  #scene: Scene | null = null;
  #horizontalInput: PointerHorizontalInput | null = null;
  #ballController: BallController | null = null;
  #ballVisualController: BallVisualController | null = null;
  #cameraController: CameraController | null = null;
  #boostController: BoostController | null = null;
  #speedFeedback: SpeedFeedback | null = null;
  #boostButton: BoostButtonController | null = null;
  #coinCollectionController: CoinCollectionController | null = null;
  #coinGenerator: CoinGenerator | null = null;
  #slowModeController: SlowModeController | null = null;
  #slowModeButton: SlowModeButtonController | null = null;
  #platformPool: PlatformPool | null = null;
  #platformLabels: PlatformLabels | null = null;
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
    this.#interfaceToggleElement = requireMenuButton(document.body, "#interface-toggle");
    this.#resumeButtonElement = requireMenuButton(pauseMenu.menu, "#resume-button");
    this.#pauseRestartButtonElement = requireMenuButton(pauseMenu.menu, "#pause-restart-button");
    this.#exitButtonElement = requireMenuButton(pauseMenu.menu, "#exit-button");
    this.#actions = actions;
    this.#interfaceVisible = readBooleanPreference(INTERFACE_PREFERENCE_KEY, true);
    this.#pauseMenuElement.hidden = true;
    this.#pauseButtonElement.disabled = true;
    this.#pauseButtonElement.setAttribute("aria-expanded", "false");
    this.#applyInterfacePreference();
    this.#pauseButtonElement.addEventListener("click", this.#pauseGame);
    this.#resumeButtonElement.addEventListener("click", this.#resumeGame);
    this.#pauseRestartButtonElement.addEventListener("click", this.#restartGame);
    this.#exitButtonElement.addEventListener("click", this.#exitGame);
    this.#interfaceToggleElement.addEventListener("click", this.#toggleInterface);
    requireMenuButton(this.#interfaceLayerElement, "#dismiss-boost-coach").addEventListener("click", this.#dismissBoostCoach);
    document.addEventListener("keydown", this.#handleKeyDown);
    document.addEventListener("visibilitychange", this.#cancelHiddenCelebration);
    window.addEventListener("blur", this.#cancelHiddenCelebration);
  }

  public async reset(): Promise<void> {
    if (this.#isDisposed) throw new Error("Application has been disposed");
    this.#clearRun(true);
    this.#runProgress = new RunProgress();
    this.#combo = new ComboController();
    this.#boostCoach = new BoostCoach();
    this.#challengeRemaining = 0;
    this.#challengeDirector = null;
    this.#hitStopRemaining = 0;
    this.#energyHighWater = this.#config.economy.initialEnergy;
    this.#lastDepthCheckpoint = 0;
    this.#missionIntroRemaining = 0;
    this.#lastLifeCount = this.#config.run.initialLives;
    this.#missionRewardRemaining = 0;
    this.#missionSaveFailed = false;
    this.#gameState = new GameStateController();
    this.#lives = new LifeCounter(this.#config.run.initialLives);
    this.#wallet = new RunWallet(this.#config.economy.initialEnergy, this.#config.economy.energyPerCoin);
    this.#elapsedPlatformSeconds = 0;
    this.#destroyedPlatformCount = 0;
    this.#recordCelebrated = false;
    this.#recordHapticTimer = null;
    this.#opening = null;
    this.#contextGuide = null;
    this.#guideStrengths = [];
    this.#stateBeforePause = GameState.Playing;
    await this.start(false);
    this.#canvas.focus();
  }

  public async start(guided = this.#actions.guided === true): Promise<void> {
    this.#gameOverElement.hidden = true;
    this.#comboView = new ComboView(requireMenuElement(this.#interfaceLayerElement, "#combo-panel"));
    this.#fixedStep.register(this.#comboView);
    this.#comboView.render(this.#combo);
    this.#renderLives();
    this.#renderCurrency();
    if (this.#mainScene === null) {
      const { engine, renderer } = await createEngine(this.#canvas);
      if (this.#hasBeenDisposed()) { engine.dispose(); return; }
      this.#engine = engine;
      this.#renderer = renderer;
      const mainScene = await createMainScene(engine, this.#config, {
        theme: this.#profile.equipment.world,
        lanterns: this.#profile.equipment.props === "props-lanterns",
      });
      if (this.#hasBeenDisposed()) { mainScene.scene.dispose(); engine.dispose(); return; }
      this.#mainScene = mainScene;
      this.#scene = mainScene.scene;
      this.#runResources = new RunSceneResources(mainScene.scene);
    }
    const mainScene = this.#mainScene;
    const engine = this.#engine;
    if (engine === null) throw new Error("Engine is unavailable");
    this.#scene = mainScene.scene;
    this.#feel = new GameFeel(this.#scene, this.#canvas);
    this.#backdrop = new DepthBackdrop(this.#scene, mainScene.cameraRig, {
      theme: this.#profile.equipment.world, lanterns: this.#profile.equipment.props === "props-lanterns",
    });
    requireMenuElement(this.#interfaceLayerElement, "#boost-coach-art").innerHTML = tutorialArt.boost;
    requireMenuElement(this.#interfaceLayerElement, "#boost-coach").hidden = true;
    requireMenuElement(this.#interfaceLayerElement, "#challenge-notice").hidden = true;
    this.#runProgress.observeSpeed(this.#config.ball.startFallSpeed);
    this.#updateMission({ type: "run-start" });

    this.#horizontalInput = new PointerHorizontalInput(this.#canvas);
    const ballMesh = createBallMesh(this.#scene, this.#config);
    this.#ballController = new BallController(ballMesh, this.#horizontalInput, this.#config);
    document.body.dataset.atmosphere = this.#profile.equipment.vfx;
    this.#speedFeedback = new SpeedFeedback(
      requireMenuElement(document.body, "#speed-feedback"),
      requireMenuElement(document.body, "#boost-feedback"),
    );
    this.#fixedStep.register({ fixedUpdate: (delta: number) => { this.#opening?.fixedUpdate(delta); } });
    this.#fixedStep.register(this.#ballController);
    this.#fixedStep.register({ fixedUpdate: (delta: number, realDeltaSeconds = delta) => {
      if (this.#missionRewardRemaining > 0) {
        this.#missionRewardRemaining = Math.max(0, this.#missionRewardRemaining - realDeltaSeconds);
        if (this.#missionRewardRemaining === 0) { this.#missionIntroRemaining = 0; this.#renderMission(); }
      }
      if (this.#missionRewardRemaining <= 0 && this.#missionIntroRemaining > 0) {
        this.#missionIntroRemaining = Math.max(0, this.#missionIntroRemaining - realDeltaSeconds);
        if (this.#missionIntroRemaining === 0) this.#renderMission();
      }
      this.#runProgress.observeDepth(this.#getDepth());
      this.#runProgress.observeSpeed(this.#ballController?.fallSpeed ?? 0);
      const scripted = this.#opening?.isScripted === true;
      if (!scripted) this.#challengeDirector?.fixedUpdate(delta);
      this.#challengeRemaining = Math.max(0, this.#challengeRemaining - delta);
      this.#contextGuide?.fixedUpdate(realDeltaSeconds);
      this.#boostCoach.fixedUpdate(delta, !scripted && this.#gameState.current === GameState.Playing);
    } });
    this.#ballVisualController = new BallVisualController(
      ballMesh,
      this.#ballController,
      this.#config,
    );
    this.#fixedStep.register(this.#ballVisualController);
    this.#cameraController = new CameraController(
      mainScene.camera,
      mainScene.cameraRig,
      this.#ballController,
      mainScene.getAspectRatio,
      this.#config,
    );
    this.#fixedStep.register(this.#cameraController);
    const coins = createCoins(this.#scene, this.#config);
    this.#coinCollectionController = new CoinCollectionController(
      this.#ballController,
      coins,
      this.#wallet,
      this.#config,
    );
    this.#unsubscribeCoinCollected = this.#coinCollectionController.onCollected(
      this.#handleCoinCollected,
    );
    this.#fixedStep.register(this.#coinCollectionController);
    this.#coinGenerator = new CoinGenerator(
      this.#ballController,
      coins,
      this.#config,
    );
    this.#fixedStep.register(this.#coinGenerator);
    this.#phaseOneController = new PhaseOneController(this.#config);
    this.#unsubscribeStageChanged = this.#phaseOneController.onStageChanged(
      this.#handleStageChanged,
    );
    this.#unsubscribePhaseCompleted = this.#phaseOneController.onCompleted(
      this.#handlePhaseCompleted,
    );
    this.#renderPhaseStage();
    this.#fixedStep.register(this.#phaseOneController);
    this.#platformPool = createStaticPlatformPool(this.#scene, this.#config);
    await waitForPlatformSprites(this.#scene);
    if (this.#hasBeenDisposed()) return;
    this.#platformLabels = new PlatformLabels(this.#scene, this.#canvas,
      requireMenuElement(this.#interfaceLayerElement, "#platform-labels"), this.#platformPool.platforms);
    this.#platformGenerator = new PlatformGenerator(
      this.#ballController,
      this.#platformPool,
      this.#phaseOneController,
      this.#config,
    );
    this.#unsubscribePlatformGenerated = this.#platformGenerator.onPlatformGenerated(
      (plan) => {
        this.#coinGenerator?.handlePlatformGenerated(plan);
      },
    );
    this.#platformGenerator.allowSlowPlatforms = false;
    this.#platformGenerator.queueEncounter("chaos");
    this.#fixedStep.register(this.#platformGenerator);
    this.#challengeDirector = new ChallengeDirector((challenge) => {
      this.#platformGenerator?.queueEncounter(challenge.theme);
      const notice = requireMenuElement(this.#interfaceLayerElement, "#challenge-notice");
      notice.dataset.theme = challenge.theme;
      requireMenuElement(notice, "strong").textContent = challenge.title;
      requireMenuElement(notice, "span").textContent = challenge.text;
      this.#challengeRemaining = 7;
    });
    this.#collisionResolver = new CollisionResolver(
      this.#ballController,
      new HavokPlatformSweep(
        this.#scene,
        mainScene.physicsPlugin,
        this.#config.ball.radius,
        this.#platformPool.platforms,
      ),
    );
    this.#successfulHitEffects = new SuccessfulHitEffects(
      ballMesh,
      mainScene.camera,
      this.#config,
    );
    this.#successfulHitHandler = new SuccessfulPlatformHitHandler(
      this.#ballController,
      this.#platformPool,
      this.#successfulHitEffects,
      this.#config,
    );
    this.#unsuccessfulHitEffects = new UnsuccessfulHitEffects(
      ballMesh,
      mainScene.camera,
      this.#config,
    );
    this.#unsuccessfulHitHandler = new UnsuccessfulPlatformHitHandler(
      this.#ballController,
      this.#gameState,
      this.#lives,
      this.#unsuccessfulHitEffects,
      this.#config,
    );
    this.#unsubscribeCollision = this.#collisionResolver.onCollision(this.#handleCollision);
    this.#fixedStep.register(this.#collisionResolver);
    this.#fixedStep.register(this.#successfulHitEffects);
    this.#fixedStep.register(this.#unsuccessfulHitHandler);
    this.#fixedStep.register(this.#unsuccessfulHitEffects);
    this.#gameState.transitionTo(GameState.Playing);
    this.#runStarted = true;
    this.#pauseButtonElement.disabled = false;
    this.#slowModeController = new SlowModeController(
      this.#gameState,
      this.#wallet,
      this.#config,
      (active) => { this.#haptics.request(active ? "slowOn" : "slowOff"); if (active) this.#ballVisualController?.react("slow"); },
    );
    this.#slowModeButton = new SlowModeButtonController(
      this.#slowModeButtonElement,
      this.#slowModeController,
    );
    this.#boostController = new BoostController(
      this.#ballController,
      this.#gameState,
      this.#wallet,
      this.#config,
      () => { this.#slowModeController?.cancelForBoost(); },
    );
    this.#unsubscribeBoosted = this.#boostController.onBoosted((result) => {
      this.#contextGuide?.completed("boost");
      if (this.#platformGenerator !== null) this.#platformGenerator.allowSlowPlatforms = true;
      this.#boostCoach.boosted();
      this.#updateMission({ type: "boost" });
      this.#runProgress.observeSpeed(this.#ballController?.fallSpeed ?? 0);
      if (this.#ballController !== null) this.#feel?.boost(this.#ballController.position);
      this.#haptics.request("boost");
      this.#ballVisualController?.playBoostReaction(result);
      this.#speedFeedback?.playBoost();
      this.#cameraController?.playBoostReaction();
    });
    this.#boostButton = new BoostButtonController(
      this.#boostButtonElement,
      this.#boostCostElement,
      this.#boostEnergyElement,
      this.#boostController,
      () => { this.#haptics.request("boostUnavailable"); },
    );
    this.#fixedStep.register(this.#boostController);
    this.#setStatus(this.#renderer);
    if (guided) this.#prepareOpening(coins);
    else { document.body.dataset.guideStage = "off"; document.body.dataset.guideCombo = "true"; document.body.dataset.guideSlow = "true"; }

    this.#renderMission();
    window.addEventListener("resize", this.#resize);
    window.visualViewport?.addEventListener("resize", this.#resize);
    this.#resizeObserver = new ResizeObserver(this.#resize);
    this.#resizeObserver.observe(this.#canvas);
    this.#resize();
    this.#lastFrameTimeMs = performance.now();
    engine.runRenderLoop(this.#renderFrame);
  }

  public dispose(): void {
    this.#clearRun(false);
  }

  #clearRun(keepScene: boolean): void {
    if (this.#runStarted) this.#finishRun("interrupted");
    if (this.#recordHapticTimer !== null) clearTimeout(this.#recordHapticTimer);
    this.#haptics.cancel();
    this.#contextGuide?.dispose();
    document.body.dataset.guideStage = "off";
    this.#platformLabels?.dispose();
    this.#comboView?.dispose();
    this.#backdrop?.dispose();
    this.#backdrop = null;
    this.#feel?.dispose();
    this.#feel = null;
    this.#speedFeedback?.dispose();
    this.#isDisposed = !keepScene;
    this.#runStarted = false;
    this.#fixedStep.clear();
    requireMenuElement(this.#interfaceLayerElement, "#first-success").classList.remove("goal-celebrate");
    this.#pauseMenuElement.hidden = true;
    this.#pauseButtonElement.disabled = true;
    this.#pauseButtonElement.setAttribute("aria-expanded", "false");
    if (!keepScene) {
      this.#pauseButtonElement.removeEventListener("click", this.#pauseGame);
      this.#resumeButtonElement.removeEventListener("click", this.#resumeGame);
      this.#pauseRestartButtonElement.removeEventListener("click", this.#restartGame);
      this.#exitButtonElement.removeEventListener("click", this.#exitGame);
      this.#interfaceToggleElement.removeEventListener("click", this.#toggleInterface);
      requireMenuButton(this.#interfaceLayerElement, "#dismiss-boost-coach").removeEventListener("click", this.#dismissBoostCoach);
      document.removeEventListener("keydown", this.#handleKeyDown);
      document.removeEventListener("visibilitychange", this.#cancelHiddenCelebration);
      window.removeEventListener("blur", this.#cancelHiddenCelebration);
    }
    window.removeEventListener("resize", this.#resize);
    window.visualViewport?.removeEventListener("resize", this.#resize);
    this.#resizeObserver?.disconnect();
    this.#resizeObserver = null;
    this.#engine?.stopRenderLoop(this.#renderFrame);
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
    this.#runResources?.clear();
    if (!keepScene) {
      this.#scene?.dispose();
      this.#engine?.dispose();
      this.#scene = null;
      this.#engine = null;
      this.#mainScene = null;
      this.#runResources = null;
    }
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
    let isPaused = this.#gameState.current === GameState.Paused || this.#gameState.current === GameState.Tutorial;
    const timeScale = isPaused
      ? 1
      : (this.#slowModeController?.update(realDeltaSeconds) ?? 1);
    if (!isPaused && this.#hitStopRemaining > 0) this.#hitStopRemaining = Math.max(0, this.#hitStopRemaining - realDeltaSeconds);
    else if (!isPaused && this.#gameState.current !== GameState.GameOver) {
      this.#fixedStep.advance(realDeltaSeconds, timeScale, () => this.#hitStopRemaining <= 0 && this.#gameState.current !== GameState.GameOver && this.#gameState.current !== GameState.Paused && this.#gameState.current !== GameState.Tutorial);
    }
    isPaused = this.#gameState.current === GameState.Paused || this.#gameState.current === GameState.Tutorial;
    this.#lastFrameTimeMs = nowMs;
    this.#boostButton?.render();
    this.#slowModeButton?.render();
    this.#renderCurrency();
    this.#renderTelemetry();
    this.#speedFeedback?.render(
      this.#ballController?.fallSpeed ?? 0,
      isPaused || this.#gameState.current === GameState.GameOver,
    );
    const platformAnimationPaused = isPaused || this.#gameState.current === GameState.GameOver || document.hidden;
    this.#elapsedPlatformSeconds = advanceIdleTime(this.#elapsedPlatformSeconds, realDeltaSeconds, platformAnimationPaused, this.#reducedMotion);
    this.#renderCombo(isPaused || this.#gameState.current === GameState.GameOver);
    this.#feel?.setPaused(isPaused || document.hidden || !document.hasFocus());
    const hideNotices = isPaused || this.#gameState.current === GameState.GameOver;
    requireMenuElement(this.#interfaceLayerElement, "#boost-coach").hidden = hideNotices || !this.#boostCoach.visible;
    requireMenuElement(this.#interfaceLayerElement, "#challenge-notice").hidden = hideNotices || this.#challengeRemaining <= 0;
    if (isPaused) {
      this.#renderPauseSummary();
    }
    this.#backdrop?.update(this.#runProgress.depth, isPaused || this.#gameState.current === GameState.GameOver ? 0 : realDeltaSeconds);
    if (this.#scene !== null) setPlatformCrystalBlend(this.#scene, this.#backdrop?.crystalBlend ?? 0);
    this.#scene?.render();
    this.#contextGuide?.layout();
    this.#platformLabels?.render();
    for (const platform of this.#platformLabels?.visiblePlatforms ?? []) {
      this.#guideStrengths = [platform.strength];
      this.#opening?.platformAppeared(platform.kind);
    }
  };

  readonly #resize = (): void => {
    this.#engine?.resize(true);
    const height = this.#canvas.getBoundingClientRect().height;
    if (height > 0) {
      const top = this.#livesElement.getBoundingClientRect().bottom + 12;
      const bottom = Math.min(this.#boostButtonElement.getBoundingClientRect().top, this.#slowModeButtonElement.getBoundingClientRect().top) - 12;
      this.#cameraController?.setBallScreenRatio((top + Math.max(0, bottom - top) * .38) / height);
    }
    this.#cameraController?.resizeViewport();
  };

  #setStatus(renderer: RendererKind): void {
    this.#status.textContent = `Сцена готова · ${renderer.toUpperCase()} · ${this.#gameState.current}`;
  }

  readonly #handleCollision = (collision: PlatformCollision): void => {
    if (this.#lives.remainingLives === 0) return;
    const boostWasAvailable = this.#boostController?.canBoost ?? false;
    const destroyed = this.#successfulHitHandler?.handle(collision) ?? false;
    const strength = collision.platform.strength.toFixed(1);
    if (destroyed && this.#ballController !== null) {
      this.#ballVisualController?.react("break");
      this.#feel?.breakAt(collision.platform.mesh.position, collision.platform.kind === "super-heavy" || collision.ballSpeed >= collision.platform.strength * 1.75);
      if (!this.#reducedMotion) this.#hitStopRemaining = collision.platform.kind === "super-heavy" ? .05 : .03;
      this.#destroyedPlatformCount += 1;
      this.#runProgress.observeSpeed(collision.ballSpeed);
      const hit = this.#combo.hit(collision.ballSpeed, collision.platform.strength);
      if (this.#boostController?.recordSuccessfulHit()) this.#boostButton?.playCharged();
      this.#comboView?.hit(hit);
      this.#updateMission({ type: "hit", combo: hit.count });
      const previousLives = this.#lives.remainingLives;
      const platformEffect = this.#applyDestroyedPlatformEffect(
        collision.platform,
      );
      this.#status.textContent = `Платформа разрушена · скорость ${collision.ballSpeed.toFixed(1)} → ${this.#ballController.fallSpeed.toFixed(1)} · прочность ${strength}${platformEffect}`;
      if (hit.count === 3) { document.body.dataset.guideCombo = "true"; this.#opening?.discover("combo"); }
      this.#haptics.request(collision.platform.kind === "super-heavy" || collision.platform.strengthLevel === "high"
        ? "heavyBreak" : collision.platform.strengthLevel === "low" ? "weakBreak" : "normalBreak");
      if (collision.ballSpeed >= collision.platform.strength * 1.75) this.#haptics.request("powerfulBreak");
      if (this.#lives.remainingLives > previousLives) { this.#haptics.request("heal"); this.#feel?.heal(); this.#ballVisualController?.react("heal"); }
      return;
    }

    const bounced = this.#unsuccessfulHitHandler?.handle(collision) ?? false;
    if (bounced) {
      this.#ballVisualController?.react("hurt");
      this.#boostCoach.failedImpact();
      this.#updateMission({ type: "life-lost" });
      this.#combo.miss();
      this.#boostController?.resetComboCharge();
      this.#comboView?.miss();
      this.#renderLives();
      if (this.#gameState.current === GameState.GameOver) {
        this.#ballVisualController?.react("defeat");
        this.#emitFailedImpact();
        this.#status.textContent = "Забег завершён · все жизни потеряны";
        this.#pauseButtonElement.disabled = true;
        requireMenuElement(this.#gameOverElement, "#death-reason").textContent = describeFailedImpact(collision.ballSpeed, collision.platform.strength, this.#config.boost.speedMultiplier);
        requireMenuElement(this.#gameOverElement, "#death-platform").innerHTML = tutorialArt.platform(collision.platform.kind, collision.platform.strength);
        const previousBest = this.#history.top(1)[0]?.score ?? 0;
        const result = this.#finishRun("completed");
        const newRecord = result.score > previousBest;
        this.#gameOverElement.dataset.newRecord = String(newRecord);
        requireMenuElement(this.#gameOverElement, "#result-highlight").textContent = newRecord ? "Новый рекорд!" : "Твой результат";
        requireMenuElement(this.#gameOverElement, "#death-hint").textContent = boostWasAvailable && collision.ballSpeed * this.#config.boost.speedMultiplier >= collision.platform.strength ? "Не хватило скорости · сохрани BOOST для удара" : "Слишком прочная · смени дорожку";
        this.#gameOverElement.querySelector<HTMLDetailsElement>(".result-impact")?.removeAttribute("open");
        requireMenuElement(this.#gameOverElement, "#run-result").textContent = result.score.toLocaleString("ru-RU");
        const stats: Record<string, string> = {
          depth: `${String(result.depth)} м`, platforms: String(result.platforms),
          coins: String(result.coins), speed: `${(result.maxSpeed ?? 0).toFixed(1)} ед/с`,
          best: (this.#history.top(1)[0]?.score ?? result.score).toLocaleString("ru-RU"),
          combo: String(result.bestCombo ?? 0),
        };
        for (const [name, value] of Object.entries(stats)) requireMenuElement(this.#gameOverElement, `[data-result="${name}"]`).textContent = value;
        requireMenuElement(this.#gameOverElement, "#result-save-status").textContent =
          this.#history.storageAvailable && this.#profile.storageAvailable ? "" : "Хранилище недоступно: результат может не сохраниться после закрытия";
        this.#gameOverElement.hidden = false;
        document.querySelector<HTMLButtonElement>("#restart-button")?.focus();
        return;
      }

      this.#opening?.discover("life");
      this.#emitFailedImpact();
      this.#status.textContent = `Ошибка · отскок · скорость ${collision.ballSpeed.toFixed(1)} ниже прочности ${strength} · сброс до ${this.#config.ball.startFallSpeed.toFixed(1)}`;
      return;
    }

    this.#status.textContent = `Столкновение · скорость ${collision.ballSpeed.toFixed(1)} · прочность ${strength} · недостаточно`;
  };

  readonly #handleCoinCollected = (coin: CoinController): void => {
    this.#ballVisualController?.react("coin");
    this.#contextGuide?.completed("coin");
    this.#feel?.coin(coin.mesh.position);
    this.#updateMission({ type: "coin" });
    this.#runProgress.observeSpeed(this.#ballController?.fallSpeed ?? 0);
    this.#haptics.request(coin.chain !== null && coin.chain.remaining === 0 && !coin.chain.cancelled ? "richChain" : "coin");
    this.#renderCurrency();
    this.#renderTelemetry();
    this.#status.textContent = `Монета собрана · +${String(this.#config.economy.speedPerCoin)} к скорости · монеты ${String(this.#wallet.coins)} · энергия ${String(this.#wallet.energy)}`;
  };

  #applyDestroyedPlatformEffect(platform: PlatformController): string {
    if (platform.kind === "vitality") {
      this.#ballVisualController?.react("heal");
      const restoredLives = this.#lives.restoreLives(
        this.#config.platformEffects.vitalityLives,
      );
      this.#wallet.addEnergy(this.#config.platformEffects.vitalityEnergy);
      this.#renderLives();
      this.#renderCurrency();
      const lifeStatus =
        restoredLives > 0
          ? `+${String(restoredLives)} жизнь`
          : "здоровье полное";
      return ` · зелёная: ${lifeStatus}, +${String(this.#config.platformEffects.vitalityEnergy)} энергии`;
    }

    if (platform.kind === "time-slow") {
      this.#slowModeController?.forceStart(
        this.#config.platformEffects.forcedSlowDurationRealSeconds,
      );
      this.#slowModeButton?.render();
      return ` · белая: замедление ${String(this.#config.platformEffects.forcedSlowDurationRealSeconds)} сек`;
    }

    return platform.kind === "super-heavy" ? " · чёрная сверхтяжёлая" : "";
  }

  readonly #handleStageChanged = (stageNumber: number): void => {
    this.#runProgress.observeStage(stageNumber);
    this.#haptics.request("stage");
    this.#renderPhaseStage();
    this.#status.textContent = `Первая фаза · этап ${String(stageNumber)} из ${String(this.#config.phaseOne.stages.length)}`;
  };

  readonly #handlePhaseCompleted = (): void => {
    this.#haptics.request("phase");
    this.#renderPhaseStage();
    this.#status.textContent = "Первая фаза пройдена";
  };

  #hasBeenDisposed(): boolean {
    return this.#isDisposed;
  }

  #renderLives(): void {
    const remainingLives = this.#lives.remainingLives;
    const hearts: HTMLSpanElement[] = [];
    for (let index = 0; index < this.#config.run.initialLives; index += 1) {
      const heart = document.createElement("span");
      heart.className =
        index < remainingLives ? "life-heart" : "life-heart life-lost";
      heart.innerHTML = hudArt(index < remainingLives ? "heart-full" : "heart-lost");
      if (index >= this.#lastLifeCount && index < remainingLives) heart.classList.add("life-heal");
      heart.setAttribute("aria-hidden", "true");
      hearts.push(heart);
    }
    this.#livesElement.replaceChildren(...hearts);
    if (remainingLives < this.#lastLifeCount) {
      const lost = hearts[remainingLives];
      lost?.animate(this.#reducedMotion ? [{ opacity: 1 }, { opacity: .35 }] : [
        { transform: "scale(1.5)", opacity: 1, color: "#ff5473" }, { transform: "scale(.65)", opacity: .35 },
      ], { duration: 420 });
    }
    this.#lastLifeCount = remainingLives;
    this.#livesElement.setAttribute(
      "aria-label",
      `Жизни: ${String(remainingLives)} из ${String(this.#config.run.initialLives)}`,
    );
  }

  #renderCurrency(): void {
    const energy = formatEnergy(this.#wallet.energy);
    this.#coinCountElement.textContent = String(this.#wallet.coins);
    this.#coinCountElement.style.fontSize = this.#wallet.coins >= 1000 ? "14px" : this.#wallet.coins >= 100 ? "18px" : "24px";
    this.#coinCountElement.closest<HTMLElement>(".coin-pill")?.setAttribute("data-empty", String(this.#wallet.coins === 0));
    this.#energyHighWater = Math.max(this.#energyHighWater, this.#wallet.energy);
    const reserve = requireMenuElement(this.#interfaceLayerElement, "#energy-reserve");
    reserve.setAttribute("aria-valuenow", String(this.#wallet.energy));
    reserve.setAttribute("aria-valuemax", String(this.#energyHighWater));
    reserve.dataset.empty = String(this.#wallet.energy <= 0);
    reserve.dataset.low = String(this.#wallet.energy < (this.#boostController?.energyCost ?? 1) * 3);
    reserve.dataset.draining = String(this.#slowModeController?.isActive === true);
    requireMenuElement(reserve, "#energy-fill").style.transform = `scaleX(${String(this.#wallet.energy / Math.max(1, this.#energyHighWater))})`;
    requireMenuElement(reserve, "#energy-amount").textContent = energy;
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
      : `ЭТАП ${String(phase.currentStageNumber)}/${String(this.#config.phaseOne.stages.length)}`;
    this.#phaseStageElement.setAttribute(
      "aria-label",
      phase.isComplete
        ? "Первая фаза пройдена"
        : `Первая фаза, этап ${String(phase.currentStageNumber)} из ${String(this.#config.phaseOne.stages.length)}`,
    );
  }

  #renderTelemetry(): void {
    const ball = this.#ballController;
    if (ball === null) {
      this.#speedValueElement.textContent = "0";
      this.#breakthroughValueElement.textContent = "0";
      this.#breakthroughHintElement.textContent = "0";
      requireMenuElement(this.#depthValueElement, "#depth-number").textContent = "0";
      return;
    }

    const speed = Math.max(0, ball.fallSpeed);
    const breakthrough = Math.floor(speed);
    const depth = this.#runProgress.depth;
    const checkpoint = Math.floor(depth / 100);
    if (checkpoint > this.#lastDepthCheckpoint) this.#feel?.depth();
    this.#lastDepthCheckpoint = checkpoint;
    requireMenuElement(this.#interfaceLayerElement, "#run-score").textContent =
      String(calculateScore(depth, this.#wallet.coins, this.#destroyedPlatformCount, this.#combo.bonus));
    const speedText = (Math.floor(speed * 10) / 10).toFixed(1);
    this.#speedValueElement.textContent = speedText;
    this.#speedValueElement.dataset.digits = String(Math.min(7, speedText.length));
    this.#breakthroughValueElement.textContent = String(breakthrough);
    this.#breakthroughHintElement.textContent = String(breakthrough);
    requireMenuElement(this.#depthValueElement, "#depth-number").textContent = depth.toFixed(0);
  }

  readonly #pauseGame = (): void => {
    const currentState = this.#gameState.current;
    if (
      currentState === GameState.Loading ||
      currentState === GameState.Tutorial ||
      currentState === GameState.Paused ||
      currentState === GameState.GameOver ||
      currentState === GameState.Results
    ) {
      return;
    }

    this.#haptics.cancel();
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

  readonly #toggleInterface = (): void => {
    this.#interfaceVisible = !this.#interfaceVisible;
    writeBooleanPreference(INTERFACE_PREFERENCE_KEY, this.#interfaceVisible);
    this.#applyInterfacePreference();
  };

  readonly #handleKeyDown = (event: KeyboardEvent): void => {
    if (document.querySelector("dialog:modal") !== null) return;
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
    this.#pauseDepthElement.textContent = `${String(this.#runProgress.depth)} м`;
    this.#pauseCoinElement.textContent = String(this.#wallet.coins);
    renderPinnedMission(this.#pauseMenuElement, this.#profile);
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

  #prepareOpening(coins: readonly CoinController[]): void {
    const pool = this.#platformPool;
    const ball = this.#ballController;
    const dialog = document.querySelector("#context-guide");
    if (pool === null || ball === null || !(dialog instanceof HTMLDialogElement)) throw new Error("Guided opening is unavailable");
    for (const platform of pool.platforms) if (platform.isActive) pool.release(platform);
    for (const coin of coins) coin.deactivate();
    if (this.#platformGenerator !== null) this.#platformGenerator.enabled = false;
    document.body.dataset.guideStage = "platform";
    document.body.dataset.guideCombo = "false";
    document.body.dataset.guideSlow = "true";
    this.#contextGuide = new ContextGuide(dialog,
      () => { this.#opening?.skip(); document.body.dataset.guideStage = "off"; document.body.dataset.guideCombo = "true"; document.body.dataset.guideSlow = "true"; },
    );
    const spawn = (x: number, y: number, strength: number, widthScale: number, kind: "standard" | "super-heavy" = "standard"): void => {
      this.#guideStrengths.push(strength);
      pool.acquire(new Vector3(x, y, this.#config.playSpace.depth), {
        strength, strengthLevel: strength > 15 ? "high" : "low", widthScale, kind, routeKind: "mandatory",
      });
    };
    this.#opening = new StagedOpening({
      readyForBoost: () => this.#boostController?.canBoost ?? false,
      spawn: (kind) => {
        this.#guideStrengths = [];
        document.body.dataset.guideStage = kind === "practice" ? "fork" : kind;
        if (kind === "platform") spawn(ball.position.x, ball.position.y - 3.5, 7, 0.8);
        if (kind === "coin") coins.find((coin) => !coin.isActive)?.reactivate({ x: ball.position.x, y: ball.position.y - 5 });
        if (kind === "boost") spawn(ball.position.x, ball.position.y - 8, Math.ceil(ball.fallSpeed * 1.25), 0.72);
        if (kind === "practice") {
          spawn(ball.position.x, ball.position.y - 4, Math.max(1, Math.floor(ball.fallSpeed * 0.7)), 0.55);
          if ((this.#opening?.elapsed ?? 0) >= 4) coins.find((coin) => !coin.isActive)?.reactivate({ x: ball.position.x, y: ball.position.y - 3.1 });
        }
        if (kind === "fork") {
          spawn(-2.5, ball.position.y - 9, Math.max(1, Math.floor(ball.fallSpeed * 0.7)), 0.66);
          spawn(2.5, ball.position.y - 9, Math.ceil(ball.fallSpeed * 1.8), 0.66, "super-heavy");
        }
      },
      explain: (tip) => {
        if (tip === "time-slow") document.body.dataset.guideSlow = "true";
        this.#contextGuide?.show(tip, tip === "platform" ? () => this.#feel?.screenPoint(ball.position) ?? null
          : tip === "coin" ? () => { const coin = coins.find((candidate) => candidate.isActive); return coin === undefined ? null : this.#feel?.screenPoint(coin.mesh.position) ?? null; } : undefined);
      },
      random: () => {
        for (const platform of pool.platforms) if (platform.isActive) pool.release(platform);
        for (const coin of coins) coin.deactivate();
        this.#platformGenerator?.resumeFromCurrentPosition();
        this.#platformGenerator?.queueEncounter("chaos");
        document.body.dataset.guideStage = "free";
      },
      complete: saveFinishedOpening,
    });
  }

  #renderCombo(paused: boolean): void {
    const ball = this.#ballController;
    if (ball === null) return;
    const platforms = this.#platformPool?.platforms ?? [];
    const nearest = nearestInCurrentLane(platforms, ball.position, this.#config.ball.radius);
    const elapsed = this.#elapsedPlatformSeconds;
    const closingSpeed = ball.fallSpeed * (this.#slowModeController?.timeScale ?? 1);
    const secondsToImpact = nearest === null ? Infinity : Math.max(0, ball.position.y - this.#config.ball.radius - nearest.mesh.position.y - nearest.size.height / 2) / Math.max(.001, closingSpeed);
    const decisionVisible = secondsToImpact <= 1.6 && this.#gameState.current !== GameState.BounceRecovery;
    for (const platform of platforms) platform.setApproachFeedback(platform === nearest && decisionVisible ? ball.fallSpeed : null, elapsed, this.#boostController?.canBoost ?? false, this.#config.boost.speedMultiplier, secondsToImpact);
    this.#ballVisualController?.setDanger(nearest?.approachState === "danger");
    requireMenuElement(this.#interfaceLayerElement, "#speed-panel").dataset.warning = String(nearest?.approachState === "danger");
    const opportunity = nearest?.approachState === "boost";
    requireMenuElement(this.#interfaceLayerElement, "#boost-coach p").textContent = this.#boostController?.hasCharge ? "Используй BOOST или обойди." : `${String(this.#config.boost.comboHitsRequired)} пробитий подряд заряжают BOOST.`;
    this.#boostButtonElement.classList.toggle("boost-opportunity", opportunity);
    this.#boostButtonElement.style.setProperty("--approach-glow", String((Math.sin(elapsed * Math.PI * 1.6) + 1) / 2));
    this.#comboView?.render(this.#combo);
    this.#speedValueElement.dataset.power = ball.fallSpeed >= 30 ? "high" : ball.fallSpeed >= 18 ? "rising" : "base";
    this.#comboView?.setPaused(paused);
    const phase = this.#phaseOneController;
    if (phase !== null) {
      const progress = requireMenuElement(this.#interfaceLayerElement, "#phase-progress");
      progress.setAttribute("value", String(phase.phaseElapsedSeconds / phase.totalDurationSeconds));
      progress.setAttribute("aria-valuetext", `Этап ${String(phase.currentStageNumber)}`);

    }

  }

  readonly #dismissBoostCoach = (): void => { this.#boostCoach.dismiss(); };

  readonly #cancelHiddenCelebration = (): void => {
    if ((document.hidden || !document.hasFocus()) && this.#recordHapticTimer !== null) {
      clearTimeout(this.#recordHapticTimer);
      this.#recordHapticTimer = null;
    }
  };

  #emitFailedImpact(): void {
    if (this.#ballController !== null && this.#feel !== null) this.#feel.error(this.#ballController.position);
    else getGameSounds().play("impact");
    this.#haptics.request("blockedImpact");
    this.#haptics.request("bounce");
    this.#haptics.request("lifeLost");
    if (this.#lives.remainingLives === 1) this.#haptics.request("lastLife");
  }

  #finishRun(outcome: "completed" | "interrupted") {
    const previousBest = this.#history.top(1)[0]?.score ?? 0;
    const result = this.#runProgress.finish(
      this.#history, this.#wallet.coins, this.#destroyedPlatformCount, outcome,
      { best: this.#combo.best, bonus: this.#combo.bonus },
    );
    this.#profile.creditRuns([result]);
    if (outcome === "completed" && !this.#recordCelebrated && result.score > previousBest) {
      this.#recordCelebrated = true;
      this.#recordHapticTimer = setTimeout(() => {
        this.#recordHapticTimer = null;
        if (!this.#isDisposed && this.#gameState.current === GameState.GameOver) this.#haptics.request("record");
      }, 900);
    }
    return result;
  }

  #updateMission(event: MissionEvent): void {
    const beforeProgress = this.#profile.mission.progress;
    const result = this.#profile.applyMissionEvent(event);
    if (!result.rewarded && event.type !== "run-start" && event.type !== "life-lost" && this.#profile.mission.progress !== beforeProgress) this.#missionIntroRemaining = 1.2;
    this.#missionSaveFailed = !result.saved || !this.#profile.storageAvailable;
    if (result.rewarded) {
      this.#missionRewardRemaining = 2;
      this.#missionIntroRemaining = 0;
      const panel = requireMenuElement(this.#interfaceLayerElement, "#first-success");
      panel.classList.remove("goal-celebrate");
      // Restart the short reward flash for every completed mission.
      void panel.offsetWidth;
      panel.classList.add("goal-celebrate");
    }
    this.#renderMission();
  }

  #renderMission(): void {
    const panel = requireMenuElement(this.#interfaceLayerElement, "#first-success");
    const state = this.#profile.mission;
    const mission = currentMission(state);
    panel.dataset.complete = String(this.#missionRewardRemaining > 0);
    panel.hidden = this.#missionRewardRemaining <= 0 && (this.#profile.activeMission === null || this.#missionIntroRemaining <= 0 || this.#opening?.isScripted === true);
    renderPinnedMission(this.#pauseMenuElement, this.#profile);
    panel.dataset.mode = this.#missionRewardRemaining > 0 ? "reward" : "intro";
    panel.dataset.mission = String(state.index);
    panel.dataset.progress = this.#missionRewardRemaining > 0 ? "3" : state.progress <= 0 ? "0" : state.progress / mission.target >= .5 ? "2" : "1";
    requireMenuElement(panel, "strong").textContent = this.#missionRewardRemaining > 0 ? `+${String(MISSION_REWARD)} ★` : `${mission.title} · ${String(state.progress)}/${String(mission.target)}`;
    requireMenuElement(panel, "small").textContent = this.#missionSaveFailed
      ? "Не удалось сохранить прогресс. Проверьте хранилище браузера."
      : this.#missionRewardRemaining > 0 ? `+${String(MISSION_REWARD)} ★`
        : `Задание ${String(state.index + 1)} · награда ★ ${String(MISSION_REWARD)}${mission.kind === "clean" || mission.kind === "combo" ? " · потеря ♥ сбрасывает прогресс" : ""}`;
  }


  #getDepth(): number {
    const ball = this.#ballController;
    return ball === null
      ? 0
      : Math.max(0, this.#config.ball.startPosition.y - ball.position.y);
  }
}
