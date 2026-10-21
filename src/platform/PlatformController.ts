import { approachState, requiredSpeed, type ApproachState } from "./PlatformReadability";
import { platformSpriteRow, debrisSpriteRect } from "./PlatformSpriteLayout";
import { PlatformSprite, createAtlasSprite, setAtlasQuad } from "./PlatformSprites";
import { Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { PhysicsBody, PhysicsMotionType, PhysicsShapeBox } from "@babylonjs/core/Physics";
import type { Scene } from "@babylonjs/core/scene";
import type { GameConfig, PlatformKind, PlatformStrengthLevel, StaticPlatformConfig } from "../config/gameConfig";

export type PlatformRouteKind = "mandatory" | "bypass" | "boost";
export interface PlatformActivationProperties {
  readonly strength: number;
  readonly strengthLevel: PlatformStrengthLevel;
  readonly routeKind?: PlatformRouteKind;
  readonly widthScale?: number;
  readonly isTrap?: boolean;
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
  #approachState: ApproachState | null = null;
  #elapsed = 0;

  public constructor(scene: Scene, config: GameConfig, platform: StaticPlatformConfig) {
    this.id = platform.id; this.size = platform.size; this.#scene = scene;
    this.#strength = requiredSpeed(platform.strength); this.#strengthLevel = platform.strengthLevel;
    this.#startPosition = new Vector3(platform.position.x, platform.position.y, config.playSpace.depth);
    // Keep Havok and sweep queries on their original box, independently of the artwork.
    this.mesh = MeshBuilder.CreateBox(platform.id, { width: this.size.width, height: this.size.height, depth: this.size.depth }, scene);
    this.mesh.position.copyFrom(this.#startPosition);
    this.mesh.isVisible = false; this.mesh.isPickable = false;
    this.#sprite = new PlatformSprite(this.mesh, this.size.height, this.size.depth, scene);
    this.#applyActivationProperties({ strength: platform.strength, strengthLevel: platform.strengthLevel });
    this.#createPhysicsResources();
  }
  public get isActive(): boolean { return this.#isActive; }
  public get strength(): number { return this.#strength; }
  public get strengthLevel(): PlatformStrengthLevel { return this.#strengthLevel; }
  public get routeKind(): PlatformRouteKind { return this.#routeKind; }
  public get kind(): PlatformKind { return this.#kind; }
  public get width(): number { return this.size.width * this.mesh.scaling.x; }
  public get activationId(): number { return this.#activationId; }
  public get isBreaking(): boolean { return this.#isBreaking; }
  public get approachState(): ApproachState | null { return this.#approachState; }

  public setApproachFeedback(speed: number | null, elapsedSeconds = 0, boostAvailable = true, boostMultiplier = 1.5, secondsToImpact = Infinity): void {
    if (!this.#isActive) return;
    this.#elapsed = elapsedSeconds;
    this.#approachState = speed === null ? null : approachState(speed, this.#strength, boostAvailable, boostMultiplier, secondsToImpact);
    this.#sprite.render(this.width, platformSpriteRow(this.#kind, this.#approachState), elapsedSeconds);
    // Health/slow sprites retain their green/ripple identity; the existing !/ϟ cue
    // remains attached to the nearest collision point rather than every lane.
    this.#sprite.mesh.visibility = 1;
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
    this.#disposePhysicsResources(); this.#isActive = false; this.#isBreaking = true;
    return true;
  }
  public renderBreak(progress: number): void { this.#sprite.renderBreak(this.width, progress); }
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
    this.#applyActivationProperties(properties ?? { strength: this.#strength, strengthLevel: this.#strengthLevel, kind: this.#kind, routeKind: this.#routeKind });
    this.mesh.visibility = 1; this.#sprite.mesh.visibility = 1;
    this.mesh.setEnabled(true); this.mesh.computeWorldMatrix(true);
    this.#createPhysicsResources(); this.#activationId++; this.#isActive = true;
  }
  public dispose(): void { this.#disposePhysicsResources(); this.mesh.dispose(); }
  #createPhysicsResources(): void {
    this.#body = new PhysicsBody(this.mesh, PhysicsMotionType.STATIC, false, this.#scene);
    this.#shape = new PhysicsShapeBox(Vector3.Zero(), Quaternion.Identity(), new Vector3(this.width, this.size.height, this.size.depth), this.#scene);
    this.#body.shape = this.#shape;
  }
  #disposePhysicsResources(): void {
    this.#body?.dispose(); this.#shape?.dispose(); this.#body = null; this.#shape = null;
  }
  #applyActivationProperties(properties: PlatformActivationProperties): void {
    this.#strength = requiredSpeed(properties.strength); this.#strengthLevel = properties.strengthLevel;
    this.#routeKind = properties.routeKind ?? "mandatory"; this.#kind = properties.kind ?? "standard";
    this.#approachState = null; this.mesh.scaling.x = properties.widthScale ?? 1;
    this.#sprite.render(this.width, platformSpriteRow(this.#kind, null), this.#elapsed);
    this.mesh.metadata = { platformId: this.id, strength: this.#strength, strengthLevel: this.#strengthLevel,
      routeKind: this.#routeKind, kind: this.#kind, widthScale: this.mesh.scaling.x, isTrap: properties.isTrap === true };
  }
}
