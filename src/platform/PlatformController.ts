import type { PlatformEncounterTheme } from "./PlatformRoutePlanner";
import type { PlatformMechanic } from "./PlatformMechanic";
import { PlatformMechanicSkin } from "./PlatformMechanicSkin";
import { SkyPlatformSkin } from "./SkyPlatformSkin";
import { skyPlatformAppearance, type SkyPlatformAppearance } from "./SkyPlatformAppearance";
import { locationAtDepth } from "../progression/WorldProgression";
import { approachState, requiredSpeed, type ApproachState } from "./PlatformReadability";
import { platformSpriteRow, debrisSpriteRect } from "./PlatformSpriteLayout";
import { PlatformSprite, createAtlasSprite, setAtlasQuad } from "./PlatformSprites";
import { Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { HavokPlugin, PhysicsBody, PhysicsMotionType, PhysicsShapeBox } from "@babylonjs/core/Physics";
import type { Scene } from "@babylonjs/core/scene";
import type { GameConfig, PlatformKind, PlatformStrengthLevel, StaticPlatformConfig } from "../config/gameConfig";

export type PlatformRouteKind = "mandatory" | "bypass" | "boost";
export interface PlatformActivationProperties {
  readonly appearance?: SkyPlatformAppearance;
  readonly mechanic?: PlatformMechanic;
  readonly strength: number;
  readonly strengthLevel: PlatformStrengthLevel;
  readonly routeKind?: PlatformRouteKind;
  readonly widthScale?: number;
  readonly encounterTheme?: PlatformEncounterTheme;
  readonly isTrap?: boolean;
  readonly lateralMotion?: Readonly<{ amplitude: number; period: number; phase: number }>;
  readonly tutorialDanger?: boolean;
  readonly kind?: PlatformKind;
}

export class PlatformController {
  public readonly id: string;
  public readonly mesh: Mesh;
  public readonly size: StaticPlatformConfig["size"];
  readonly #sprite: PlatformSprite;
  readonly #startPosition: Vector3;
  readonly #scene: Scene;
  #body: PhysicsBody | null = null;
  #shape: PhysicsShapeBox | null = null;
  #isActive = true;
  #isBreaking = false;
  #activationId = 1;
  #strength: number;
  #strengthLevel: PlatformStrengthLevel;
  #routeKind: PlatformRouteKind = "mandatory";
  #kind: PlatformKind = "standard";
  #encounterTheme: PlatformEncounterTheme = "chaos";
  #approachState: ApproachState | null = null;
  #elapsed = 0;
  #tutorialDanger = false;
  #motion: PlatformActivationProperties["lateralMotion"];
  #motionAge = 0;
  #motionStartX = 0;
  #mechanic: PlatformMechanic | undefined;
  #machine: PlatformMechanicSkin | null = null;
  #sky: SkyPlatformSkin | null = null;
  #appearance: SkyPlatformAppearance | undefined;
  readonly #reduced = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

  public constructor(scene: Scene, config: GameConfig, platform: StaticPlatformConfig, active = true) {
    this.id = platform.id; this.size = platform.size; this.#scene = scene;
    this.#strength = requiredSpeed(platform.strength); this.#strengthLevel = platform.strengthLevel;
    this.#startPosition = new Vector3(platform.position.x, platform.position.y, config.playSpace.depth);
    // Keep Havok and sweep queries on their original box, independently of the artwork.
    this.mesh = MeshBuilder.CreateBox(platform.id, { width: this.size.width, height: this.size.height, depth: this.size.depth }, scene);
    this.mesh.position.copyFrom(this.#startPosition);
    this.mesh.isVisible = false; this.mesh.isPickable = false;
    this.#sprite = new PlatformSprite(this.mesh, this.size.height, this.size.depth, scene);
    const initialAppearance=skyPlatformAppearance(locationAtDepth(config.startDepth+config.ball.startPosition.y-platform.position.y),"standard",undefined,config.platforms.indexOf(platform));
    this.#applyActivationProperties({ strength: platform.strength, strengthLevel: platform.strengthLevel,
      ...(initialAppearance===undefined?{}:{appearance:initialAppearance}) });
    this.#isActive = active;
    this.mesh.setEnabled(active);
    if (active) this.#createPhysicsResources();
  }
  public get lateralMotion(): PlatformActivationProperties["lateralMotion"] { return this.#motion; }
  public get motionCenterX(): number { return this.#motionStartX; }
  public get mechanic(): PlatformMechanic | undefined { return this.#mechanic; }
  public get appearance(): SkyPlatformAppearance | undefined { return this.#appearance; }
  public setMechanicAim(x: number, y: number): void { this.#machine?.aim(x,y); }
  public advanceMotion(seconds: number): void {
    if (!this.#isActive || !this.#motion) return;
    this.#motionAge += Math.max(0, seconds);
    this.mesh.position.x = this.#motionStartX + this.#motion.amplitude * Math.sin(this.#motionAge * Math.PI * 2 / this.#motion.period + this.#motion.phase);
    this.mesh.computeWorldMatrix(true);
    const plugin = this.#scene.getPhysicsEngine()?.getPhysicsPlugin();
    // Update the existing Havok box; the regular scene step refreshes its broadphase. No bodies are rebuilt.
    if (this.#body && plugin instanceof HavokPlugin) plugin.setPhysicsBodyTransformation(this.#body, this.mesh);
  }
  public get isActive(): boolean { return this.#isActive; }
  public get strength(): number { return this.#strength; }
  public get strengthLevel(): PlatformStrengthLevel { return this.#strengthLevel; }
  public get routeKind(): PlatformRouteKind { return this.#routeKind; }
  public get kind(): PlatformKind { return this.#kind; }
  public get encounterTheme(): PlatformEncounterTheme { return this.#encounterTheme; }
  public get width(): number { return this.size.width * this.mesh.scaling.x; }
  public get activationId(): number { return this.#activationId; }
  public get isBreaking(): boolean { return this.#isBreaking; }
  public get approachState(): ApproachState | null { return this.#approachState; }

  public setApproachFeedback(speed: number | null, elapsedSeconds = 0, boostAvailable = true, boostMultiplier = 1.5, secondsToImpact = Infinity, scannerWarning = false): void {
    if (!this.#isActive) return;
    this.#elapsed = elapsedSeconds;
    this.#approachState = scannerWarning || this.#tutorialDanger ? "danger" : speed === null ? null : approachState(speed, this.#strength, boostAvailable, boostMultiplier, secondsToImpact);
    this.#sprite.render(this.width, platformSpriteRow(this.#kind, this.#approachState), elapsedSeconds);
    // Health/slow sprites retain their green/ripple identity; the existing !/ϟ cue
    // remains attached to the nearest collision point rather than every lane.
    this.#sprite.mesh.visibility = 1;
    if(this.#mechanic) {
      this.#machine?.render(this.#mechanic,this.width,this.#approachState,elapsedSeconds,this.#reduced);
      this.#sprite.mesh.isVisible=false;
    } else if(this.#appearance) {
      this.#sky?.render(this.#appearance,this.width,this.#approachState,elapsedSeconds,this.#reduced);
      this.#sprite.mesh.isVisible=false;
    }
  }

  public createBreakFragment(index: number, fragmentWidth: number): Mesh {
    const fragment = createAtlasSprite(`${this.id}-fragment-${String(index)}`, this.#scene);
    const row = platformSpriteRow(this.#kind, this.#approachState);
    fragment.metadata = { spriteAtlas: "neon-rocks", row };
    const rect = debrisSpriteRect(row, index);
    const width = Math.max(.48, Math.min(1.05, fragmentWidth * .85));
    setAtlasQuad(fragment, rect, width, width * rect.height / rect.width);
    fragment.position.z = this.mesh.position.z - this.size.depth / 2 - .04;
    return fragment;
  }

  public beginBreak(): boolean {
    if (!this.#isActive) return false;
    this.#sprite.renderBreak(this.width, 0);
    if(this.#mechanic||this.#appearance)this.#sprite.mesh.isVisible=false;
    this.#disposePhysicsResources(); this.#isActive = false; this.#isBreaking = true;
    return true;
  }
  public playImpact(force = 1, contactX = this.mesh.position.x): void {
    this.#sprite.impact(this.#elapsed, force);
    if(this.#appearance)this.#sky?.impact(this.#elapsed,force,contactX-this.mesh.position.x);
  }

  public renderBreak(progress: number): void {
    this.#sprite.renderBreak(this.width, progress);
    if(this.#mechanic)this.#machine?.renderBreak(progress);
    if(this.#appearance)this.#sky?.renderBreak(progress);
  }
  public finishBreak(): boolean {
    if (!this.#isBreaking) return false;
    this.mesh.setEnabled(false); this.#isBreaking = false;
    return true;
  }
  public deactivate(): void {
    if (!this.#isActive && !this.#isBreaking) return;
    this.#disposePhysicsResources(); this.mesh.setEnabled(false);
    this.#isActive = false; this.#isBreaking = false;
  }
  public reactivate(position = this.#startPosition, properties?: PlatformActivationProperties): void {
    if (this.#isActive || this.#isBreaking) return;
    this.mesh.position.copyFrom(position); this.mesh.rotation.setAll(0); this.mesh.scaling.setAll(1);
    this.#applyActivationProperties(properties ?? { strength: this.#strength, strengthLevel: this.#strengthLevel, kind: this.#kind, routeKind: this.#routeKind, encounterTheme: this.#encounterTheme });
    this.mesh.visibility = 1; this.#sprite.mesh.visibility = 1;
    this.mesh.setEnabled(true); this.mesh.computeWorldMatrix(true);
    this.#createPhysicsResources(); this.#activationId++; this.#isActive = true;
  }
  public dispose(): void { this.#disposePhysicsResources(); this.mesh.dispose(); }
  #createPhysicsResources(): void {
    this.#body = new PhysicsBody(this.mesh, PhysicsMotionType.STATIC, false, this.#scene);
    this.#shape = new PhysicsShapeBox(Vector3.Zero(), Quaternion.Identity(), new Vector3(this.width, this.size.height, this.size.depth), this.#scene);
    this.#body.shape = this.#shape;
    if (this.#motion) this.#body.disablePreStep = false;
  }
  #disposePhysicsResources(): void {
    this.#body?.dispose(); this.#shape?.dispose(); this.#body = null; this.#shape = null;
  }
  #applyActivationProperties(properties: PlatformActivationProperties): void {
    this.#mechanic = properties.mechanic;
    this.#strength = requiredSpeed(properties.strength); this.#strengthLevel = properties.strengthLevel;
    this.#routeKind = properties.routeKind ?? "mandatory"; this.#kind = properties.kind ?? "standard";
    this.#appearance=this.#kind==="standard"&&this.#mechanic===undefined?properties.appearance:undefined;
    this.#encounterTheme = properties.encounterTheme ?? "chaos";
    this.#tutorialDanger = properties.tutorialDanger === true;
    this.#motion = properties.lateralMotion; this.#motionAge = 0; this.#motionStartX = this.mesh.position.x;
    this.#sprite.resetImpact();
    this.#approachState = null; this.mesh.scaling.x = properties.widthScale ?? 1;
    this.#sprite.render(this.width, platformSpriteRow(this.#kind, null), this.#elapsed);
    this.#sprite.mesh.isVisible=this.#mechanic===undefined&&this.#appearance===undefined;
    this.#machine?.reset();
    this.#sky?.reset();
    if(this.#mechanic) {
      this.#machine??=new PlatformMechanicSkin(this.mesh,this.size.height,this.size.depth,this.#scene);
      this.#machine.render(this.#mechanic,this.width,null,this.#elapsed,this.#reduced);
    } else this.#machine?.hide();
    if(this.#appearance){
      this.#sky??=new SkyPlatformSkin(this.mesh,this.size.height,this.size.depth,this.#scene);
      this.#sky.render(this.#appearance,this.width,null,this.#elapsed,this.#reduced);
    }
    this.mesh.metadata = { platformId: this.id, strength: this.#strength, strengthLevel: this.#strengthLevel,
      routeKind: this.#routeKind, encounterTheme: this.#encounterTheme, kind: this.#kind, appearance:this.#appearance??"island", widthScale: this.mesh.scaling.x, isTrap: properties.isTrap === true };
  }
}
