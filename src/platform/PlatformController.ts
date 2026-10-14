import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { FresnelParameters } from "@babylonjs/core/Materials/fresnelParameters";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import "@babylonjs/core/Rendering/outlineRenderer";
import {
  PhysicsBody,
  PhysicsMotionType,
  PhysicsShapeBox,
} from "@babylonjs/core/Physics";
import type { Scene } from "@babylonjs/core/scene";
import type {
  GameConfig,
  PlatformKind,
  PlatformStrengthLevel,
  StaticPlatformConfig,
} from "../config/gameConfig";

export type PlatformRouteKind = "mandatory" | "bypass" | "boost";

export interface PlatformActivationProperties {
  readonly strength: number;
  readonly strengthLevel: PlatformStrengthLevel;
  readonly routeKind?: PlatformRouteKind;
  readonly widthScale?: number;
  readonly isTrap?: boolean;
  readonly kind?: PlatformKind;
}

interface PlatformOutlinePoint {
  readonly x: number;
  readonly y: number;
}

function createPlatformOutline(
  kind: PlatformKind,
  width: number,
  height: number,
): readonly PlatformOutlinePoint[] {
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  if (kind === "vitality") {
    return Array.from({ length: 20 }, (_, index) => {
      const angle = Math.PI / 2 - (index / 20) * Math.PI * 2;
      const cosine = Math.cos(angle);
      const sine = Math.sin(angle);
      return {
        x:
          halfWidth *
          Math.sign(cosine) *
          Math.abs(cosine) ** 0.42,
        y:
          halfHeight *
          Math.sign(sine) *
          Math.abs(sine) ** 0.7,
      };
    });
  }

  if (kind === "time-slow") {
    return [
      { x: -halfWidth, y: 0 },
      { x: -halfWidth * 0.88, y: halfHeight * 0.58 },
      { x: -halfWidth * 0.6, y: halfHeight },
      { x: -halfWidth * 0.12, y: halfHeight * 0.86 },
      { x: halfWidth * 0.42, y: halfHeight },
      { x: halfWidth * 0.86, y: halfHeight * 0.54 },
      { x: halfWidth, y: 0 },
      { x: halfWidth * 0.84, y: -halfHeight * 0.56 },
      { x: halfWidth * 0.38, y: -halfHeight },
      { x: -halfWidth * 0.16, y: -halfHeight * 0.84 },
      { x: -halfWidth * 0.64, y: -halfHeight },
      { x: -halfWidth * 0.9, y: -halfHeight * 0.5 },
    ];
  }

  if (kind === "super-heavy") {
    return [
      { x: -halfWidth, y: halfHeight * 0.28 },
      { x: -halfWidth * 0.86, y: halfHeight * 0.78 },
      { x: -halfWidth * 0.62, y: halfHeight },
      { x: -halfWidth * 0.42, y: halfHeight * 0.76 },
      { x: -halfWidth * 0.12, y: halfHeight },
      { x: halfWidth * 0.1, y: halfHeight * 0.72 },
      { x: halfWidth * 0.46, y: halfHeight },
      { x: halfWidth * 0.72, y: halfHeight * 0.76 },
      { x: halfWidth, y: halfHeight * 0.22 },
      { x: halfWidth * 0.9, y: -halfHeight * 0.42 },
      { x: halfWidth * 0.66, y: -halfHeight },
      { x: halfWidth * 0.32, y: -halfHeight * 0.78 },
      { x: 0, y: -halfHeight },
      { x: -halfWidth * 0.3, y: -halfHeight * 0.76 },
      { x: -halfWidth * 0.7, y: -halfHeight },
      { x: -halfWidth * 0.92, y: -halfHeight * 0.38 },
    ];
  }

  return [
    { x: -halfWidth, y: halfHeight * 0.35 },
    { x: -halfWidth * 0.82, y: halfHeight },
    { x: -halfWidth * 0.42, y: halfHeight * 0.88 },
    { x: -halfWidth * 0.08, y: halfHeight },
    { x: halfWidth * 0.28, y: halfHeight * 0.9 },
    { x: halfWidth * 0.78, y: halfHeight },
    { x: halfWidth, y: halfHeight * 0.34 },
    { x: halfWidth * 0.95, y: -halfHeight * 0.38 },
    { x: halfWidth * 0.76, y: -halfHeight },
    { x: halfWidth * 0.3, y: -halfHeight * 0.88 },
    { x: -halfWidth * 0.06, y: -halfHeight },
    { x: -halfWidth * 0.48, y: -halfHeight * 0.86 },
    { x: -halfWidth * 0.84, y: -halfHeight },
    { x: -halfWidth, y: -halfHeight * 0.3 },
  ];
}

function createStylizedPlatformVertexData(
  width: number,
  height: number,
  depth: number,
  kind: PlatformKind,
): VertexData {
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const visualDepth =
    kind === "super-heavy"
      ? depth * 1.12
      : kind === "time-slow"
        ? depth * 0.78
        : kind === "vitality"
          ? depth * 0.88
          : depth;
  const halfDepth = visualDepth / 2;
  const outline = createPlatformOutline(kind, width, height);
  const faceInset =
    kind === "vitality"
      ? Math.min(height * 0.19, 0.09)
      : Math.min(height * 0.14, 0.07);
  const frontScaleX = (halfWidth - faceInset) / halfWidth;
  const frontScaleY = (halfHeight - faceInset) / halfHeight;
  const faceOutline = outline.map((point) => ({
    x: point.x * frontScaleX,
    y: point.y * frontScaleY,
  }));
  const bevelDepth = Math.min(visualDepth * 0.13, 0.11);
  const rings = [faceOutline, outline, outline, faceOutline] as const;
  const ringDepths = [
    halfDepth,
    halfDepth - bevelDepth,
    -halfDepth + bevelDepth,
    -halfDepth,
  ] as const;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let ringIndex = 0; ringIndex < rings.length; ringIndex += 1) {
    const ring = rings[ringIndex];
    const z = ringDepths[ringIndex];
    if (ring === undefined || z === undefined) {
      throw new Error("Stylized platform ring data is incomplete.");
    }
    for (const point of ring) {
      positions.push(point.x, point.y, z);
      uvs.push(point.x / width + 0.5, 0.5 - point.y / height);
    }
  }

  const ringSize = outline.length;
  for (let ringIndex = 0; ringIndex < rings.length - 1; ringIndex += 1) {
    const currentStart = ringIndex * ringSize;
    const nextStart = (ringIndex + 1) * ringSize;
    for (let index = 0; index < ringSize; index += 1) {
      const nextIndex = (index + 1) % ringSize;
      const current = currentStart + index;
      const currentNext = currentStart + nextIndex;
      const followingNext = nextStart + nextIndex;
      const following = nextStart + index;
      indices.push(
        current,
        currentNext,
        followingNext,
        current,
        followingNext,
        following,
      );
    }
  }

  const frontCenterIndex = positions.length / 3;
  positions.push(0, 0, halfDepth);
  uvs.push(0.5, 0.5);
  const backCenterIndex = positions.length / 3;
  positions.push(0, 0, -halfDepth);
  uvs.push(0.5, 0.5);
  const backRingStart = (rings.length - 1) * ringSize;
  for (let index = 0; index < ringSize; index += 1) {
    const nextIndex = (index + 1) % ringSize;
    indices.push(
      frontCenterIndex,
      nextIndex,
      index,
      backCenterIndex,
      backRingStart + index,
      backRingStart + nextIndex,
    );
  }

  const normals: number[] = [];
  VertexData.ComputeNormals(positions, indices, normals);
  const vertexData = new VertexData();
  vertexData.positions = positions;
  vertexData.indices = indices;
  vertexData.normals = normals;
  vertexData.uvs = uvs;
  return vertexData;
}

function createStylizedPlatformMesh(
  name: string,
  width: number,
  height: number,
  depth: number,
  scene: Scene,
  kind: PlatformKind,
): Mesh {
  const mesh = new Mesh(name, scene);
  createStylizedPlatformVertexData(width, height, depth, kind).applyToMesh(mesh);
  mesh.convertToFlatShadedMesh();
  mesh.isPickable = false;
  return mesh;
}

export class PlatformController {
  public readonly id: string;
  public readonly mesh: Mesh;
  public readonly size: StaticPlatformConfig["size"];

  readonly #material: StandardMaterial;
  readonly #emissiveFresnel = new FresnelParameters();
  readonly #texture: DynamicTexture | null;
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
  #visualKind: PlatformKind = "standard";

  public constructor(scene: Scene, config: GameConfig, platform: StaticPlatformConfig) {
    this.id = platform.id;
    this.#strength = platform.strength;
    this.#strengthLevel = platform.strengthLevel;
    this.size = platform.size;
    this.#scene = scene;
    this.#startPosition = new Vector3(
      platform.position.x,
      platform.position.y,
      config.playSpace.depth,
    );

    this.mesh = createStylizedPlatformMesh(
      platform.id,
      platform.size.width,
      platform.size.height,
      platform.size.depth,
      scene,
      "standard",
    );
    this.mesh.position.copyFrom(this.#startPosition);

    this.#material = new StandardMaterial(`${platform.id}-material`, scene);
    this.#material.specularColor = new Color3(0.18, 0.21, 0.24);
    this.#material.specularPower = 28;
    this.#material.ambientColor = Color3.White();
    this.#material.disableLighting = true;
    this.#material.useEmissiveAsIllumination = true;
    this.#material.backFaceCulling = false;
    this.#material.emissiveFresnelParameters = this.#emissiveFresnel;
    this.#texture =
      typeof OffscreenCanvas !== "undefined" || typeof document !== "undefined"
        ? new DynamicTexture(
            `${platform.id}-stone-texture`,
            { width: 512, height: 160 },
            scene,
            false,
          )
        : null;
    if (this.#texture !== null) {
      this.#material.diffuseTexture = this.#texture;
    }
    this.mesh.material = this.#material;
    this.mesh.renderOutline = true;
    this.mesh.outlineColor = new Color3(0.035, 0.07, 0.1);
    this.mesh.outlineWidth = 0.035;
    this.#applyActivationProperties({
      strength: platform.strength,
      strengthLevel: platform.strengthLevel,
      routeKind: "mandatory",
    });

    this.#createPhysicsResources();
  }

  public get isActive(): boolean {
    return this.#isActive;
  }

  public get strength(): number {
    return this.#strength;
  }

  public get strengthLevel(): PlatformStrengthLevel {
    return this.#strengthLevel;
  }

  public get routeKind(): PlatformRouteKind {
    return this.#routeKind;
  }

  public get kind(): PlatformKind {
    return this.#kind;
  }

  public get width(): number {
    return this.size.width * this.mesh.scaling.x;
  }

  public get activationId(): number {
    return this.#activationId;
  }

  public get isBreaking(): boolean {
    return this.#isBreaking;
  }

  public beginBreak(): boolean {
    if (!this.#isActive) {
      return false;
    }

    this.#disposePhysicsResources();
    this.#isActive = false;
    this.#isBreaking = true;
    return true;
  }

  public finishBreak(): boolean {
    if (!this.#isBreaking) {
      return false;
    }

    this.mesh.setEnabled(false);
    this.#isBreaking = false;
    return true;
  }

  public deactivate(): void {
    if (!this.#isActive && !this.#isBreaking) {
      return;
    }

    this.#disposePhysicsResources();
    this.mesh.setEnabled(false);
    this.#isActive = false;
    this.#isBreaking = false;
  }

  public reactivate(
    position = this.#startPosition,
    properties?: PlatformActivationProperties,
  ): void {
    if (this.#isActive || this.#isBreaking) {
      return;
    }

    this.mesh.position.copyFrom(position);
    this.mesh.rotation.setAll(0);
    this.mesh.scaling.setAll(1);
    if (properties !== undefined) {
      this.#applyActivationProperties(properties);
    }
    this.mesh.visibility = 1;
    this.mesh.setEnabled(true);
    this.mesh.computeWorldMatrix(true);
    this.#createPhysicsResources();
    this.#activationId += 1;
    this.#isActive = true;
  }

  public dispose(): void {
    this.#disposePhysicsResources();
    this.mesh.dispose();
    this.#texture?.dispose();
    this.#material.dispose();
  }

  #createPhysicsResources(): void {
    this.#body = new PhysicsBody(this.mesh, PhysicsMotionType.STATIC, false, this.#scene);
    this.#shape = new PhysicsShapeBox(
      Vector3.Zero(),
      Quaternion.Identity(),
      new Vector3(this.width, this.size.height, this.size.depth),
      this.#scene,
    );
    this.#body.shape = this.#shape;
  }

  #disposePhysicsResources(): void {
    this.#body?.dispose();
    this.#shape?.dispose();
    this.#body = null;
    this.#shape = null;
  }

  #applyActivationProperties(properties: PlatformActivationProperties): void {
    this.#strength = properties.strength;
    this.#strengthLevel = properties.strengthLevel;
    this.#routeKind = properties.routeKind ?? "mandatory";
    this.#kind = properties.kind ?? "standard";
    this.#applyVisualGeometry(this.#kind);
    this.mesh.scaling.x = properties.widthScale ?? 1;
    // Strength and route difficulty must not turn an ordinary platform black.
    // The volcanic skin belongs exclusively to the super-heavy gameplay type.
    const reinforced = this.#kind === "super-heavy";
    this.#material.diffuseColor =
      this.#texture === null
        ? this.#getFallbackColor(reinforced)
        : Color3.White();
    this.#material.emissiveColor = this.#getEmissiveColor(reinforced);
    this.#applyEmissiveFresnel(this.#kind);
    this.mesh.outlineColor = this.#getOutlineColor(reinforced);
    this.mesh.outlineWidth =
      this.#kind === "super-heavy" || this.#kind === "time-slow"
        ? 0.05
        : 0.04;
    this.#drawStoneTexture(properties.strength, reinforced, this.#kind);
    this.mesh.metadata = {
      platformId: this.id,
      strength: properties.strength,
      strengthLevel: properties.strengthLevel,
      routeKind: this.#routeKind,
      kind: this.#kind,
      widthScale: this.mesh.scaling.x,
      isTrap: properties.isTrap === true,
    };
  }

  #applyVisualGeometry(kind: PlatformKind): void {
    if (kind === this.#visualKind) {
      return;
    }
    createStylizedPlatformVertexData(
      this.size.width,
      this.size.height,
      this.size.depth,
      kind,
    ).applyToMesh(this.mesh);
    this.mesh.convertToFlatShadedMesh();
    this.mesh.refreshBoundingInfo();
    this.#visualKind = kind;
  }

  #applyEmissiveFresnel(kind: PlatformKind): void {
    this.#emissiveFresnel.isEnabled = kind !== "standard";
    this.#emissiveFresnel.bias = kind === "super-heavy" ? 0.08 : 0.18;
    this.#emissiveFresnel.power = kind === "time-slow" ? 2.4 : 1.8;
    this.#emissiveFresnel.leftColor =
      kind === "vitality"
        ? new Color3(0.15, 1, 0.42)
        : kind === "time-slow"
          ? new Color3(0.18, 0.78, 1)
          : new Color3(1, 0.22, 0.025);
    this.#emissiveFresnel.rightColor =
      kind === "vitality"
        ? new Color3(0.025, 0.18, 0.065)
        : kind === "time-slow"
          ? new Color3(0.035, 0.13, 0.2)
          : new Color3(0.16, 0.025, 0.004);
  }

  #getFallbackColor(reinforced: boolean): Color3 {
    if (this.#kind === "vitality") {
      return new Color3(0.3, 1, 0.48);
    }
    if (this.#kind === "time-slow") {
      return new Color3(0.72, 0.94, 1);
    }
    return reinforced
      ? new Color3(0.28, 0.3, 0.36)
      : new Color3(1, 0.72, 0.3);
  }

  #getEmissiveColor(reinforced: boolean): Color3 {
    if (this.#kind === "vitality") {
      return new Color3(0.08, 0.82, 0.24);
    }
    if (this.#kind === "time-slow") {
      return new Color3(0.18, 0.7, 1);
    }
    return reinforced
      ? new Color3(0.72, 0.13, 0.015)
      : new Color3(1, 0.47, 0.055);
  }

  #getOutlineColor(reinforced: boolean): Color3 {
    if (this.#kind === "vitality") {
      return new Color3(0.04, 0.38, 0.2);
    }
    if (this.#kind === "time-slow") {
      return new Color3(0.1, 0.36, 0.58);
    }
    return reinforced
      ? new Color3(0.38, 0.07, 0.01)
      : new Color3(0.2, 0.13, 0.07);
  }

  #drawStoneTexture(
    strength: number,
    reinforced: boolean,
    kind: PlatformKind,
  ): void {
    const texture = this.#texture;
    if (texture === null) {
      return;
    }
    const context = texture.getContext() as unknown as CanvasRenderingContext2D;
    const width = texture.getSize().width;
    const height = texture.getSize().height;
    context.clearRect(0, 0, width, height);
    const backgroundTop =
      kind === "vitality"
        ? "#52e879"
        : kind === "time-slow"
          ? "#e8fbff"
          : reinforced
            ? "#626878"
            : "#ffd46a";
    const backgroundBottom =
      kind === "vitality"
        ? "#087c42"
        : kind === "time-slow"
          ? "#38aee7"
          : reinforced
            ? "#232630"
            : "#dc7629";
    const background = context.createLinearGradient(0, 0, 0, height);
    background.addColorStop(0, backgroundTop);
    background.addColorStop(1, backgroundBottom);
    context.fillStyle = background;
    context.fillRect(0, 0, width, height);

    const columns =
      kind === "vitality" ? 7 : kind === "time-slow" ? 5 : reinforced ? 5 : 6;
    const rows = kind === "vitality" ? 3 : 2;
    const gap = 5;
    const tileWidth = width / columns;
    const tileHeight = height / rows;
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const x = column * tileWidth + gap;
        const y = row * tileHeight + gap;
        const inset = ((column * 13 + row * 7) % 4) + 1;
        const gradient = context.createLinearGradient(x, y, x, y + tileHeight);
        if (kind === "vitality") {
          gradient.addColorStop(0, "#d1ff9f");
          gradient.addColorStop(0.52, "#63e879");
          gradient.addColorStop(1, "#18a955");
        } else if (kind === "time-slow") {
          gradient.addColorStop(0, "#ffffff");
          gradient.addColorStop(0.52, "#c7f3ff");
          gradient.addColorStop(1, "#64c8f5");
        } else if (reinforced) {
          gradient.addColorStop(0, "#7a7f8c");
          gradient.addColorStop(0.52, "#4b4f5a");
          gradient.addColorStop(1, "#292b33");
        } else {
          gradient.addColorStop(0, "#fff5bd");
          gradient.addColorStop(0.55, "#ffd477");
          gradient.addColorStop(1, "#df8b3c");
        }
        context.fillStyle = gradient;
        context.shadowColor = "rgba(7, 12, 18, 0.7)";
        context.shadowBlur = 7;
        context.shadowOffsetY = 5;
        context.beginPath();
        if (kind === "vitality") {
          context.ellipse(
            x + tileWidth * 0.42,
            y + tileHeight * 0.4,
            tileWidth * (0.36 + (column % 2) * 0.025),
            tileHeight * (0.31 + (row % 2) * 0.035),
            ((column + row) % 3 - 1) * 0.12,
            0,
            Math.PI * 2,
          );
        } else if (kind === "time-slow") {
          context.roundRect(
            x,
            y + inset,
            tileWidth - gap * 2,
            tileHeight - gap * 2 - inset,
            18,
          );
        } else if (reinforced) {
          context.moveTo(x + 12, y);
          context.lineTo(x + tileWidth - gap * 2 - 14, y + inset);
          context.lineTo(x + tileWidth - gap * 2, y + tileHeight * 0.34);
          context.lineTo(x + tileWidth - gap * 2 - 7, y + tileHeight - gap * 2 - 8);
          context.lineTo(x + tileWidth * 0.56, y + tileHeight - gap * 2);
          context.lineTo(x + 5, y + tileHeight - gap * 2 - 11);
          context.lineTo(x, y + tileHeight * 0.38);
          context.closePath();
        } else {
          context.moveTo(x + 7 + inset, y);
          context.lineTo(x + tileWidth - gap * 2 - 6, y + inset);
          context.lineTo(x + tileWidth - gap * 2, y + 8);
          context.lineTo(x + tileWidth - gap * 2 - inset, y + tileHeight - gap * 2 - 6);
          context.lineTo(x + tileWidth - gap * 2 - 8, y + tileHeight - gap * 2);
          context.lineTo(x + 6, y + tileHeight - gap * 2 - inset);
          context.lineTo(x, y + tileHeight - gap * 2 - 7);
          context.lineTo(x + inset, y + 6);
          context.closePath();
        }
        context.fill();
        context.shadowBlur = 0;
        context.shadowOffsetY = 0;
        context.strokeStyle =
          kind === "time-slow"
            ? "rgba(255, 255, 255, 0.72)"
            : kind === "vitality"
              ? "rgba(195, 255, 208, 0.52)"
              : reinforced
                ? "rgba(142, 148, 158, 0.34)"
                : "rgba(255, 244, 220, 0.5)";
        context.lineWidth = 3;
        context.beginPath();
        context.moveTo(x + 10, y + 6);
        context.lineTo(x + tileWidth - gap * 2 - 12, y + 8 + inset);
        context.stroke();
      }
    }

    if (kind === "vitality") {
      context.save();
      context.strokeStyle = "rgba(111, 255, 170, 0.82)";
      context.lineWidth = 6;
      context.shadowColor = "#4dff91";
      context.shadowBlur = 14;
      for (let index = 0; index < 4; index += 1) {
        context.beginPath();
        context.moveTo(-20, 25 + index * 38);
        context.bezierCurveTo(
          width * 0.24,
          4 + index * 44,
          width * 0.58,
          142 - index * 27,
          width + 20,
          24 + index * 35,
        );
        context.stroke();
      }
      context.restore();
    } else if (kind === "time-slow") {
      context.save();
      context.translate(width / 2, height / 2);
      context.strokeStyle = "rgba(31, 153, 222, 0.6)";
      context.shadowColor = "#55d8ff";
      context.shadowBlur = 12;
      for (let index = 0; index < 5; index += 1) {
        context.lineWidth = index % 2 === 0 ? 7 : 3;
        context.beginPath();
        context.ellipse(
          0,
          0,
          54 + index * 62,
          24 + index * 11,
          0,
          Math.PI * (0.12 + index * 0.08),
          Math.PI * (1.58 + index * 0.05),
        );
        context.stroke();
      }
      context.restore();
    } else if (reinforced) {
      context.save();
      context.translate(width / 2, height / 2);
      context.rotate(Math.PI / 4);
      context.fillStyle = "rgba(24, 7, 3, 0.9)";
      context.strokeStyle = "#ff4d16";
      context.lineWidth = 8;
      context.shadowColor = "#ff5a16";
      context.shadowBlur = 18;
      context.fillRect(-32, -32, 64, 64);
      context.strokeRect(-32, -32, 64, 64);
      context.restore();
    }

    const speckleColor =
      kind === "vitality"
        ? "rgba(202, 255, 209, 0.28)"
        : kind === "time-slow"
          ? "rgba(255, 255, 255, 0.42)"
          : reinforced
            ? "rgba(255, 125, 42, 0.15)"
            : "rgba(66, 48, 34, 0.25)";
    context.fillStyle = speckleColor;
    for (let index = 0; index < 44; index += 1) {
      const x = (index * 97 + Math.round(strength) * 31) % width;
      const y = (index * 53 + Math.round(strength) * 17) % height;
      const radius = 1 + (index % 3);
      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.fill();
    }

    const crackCount = reinforced ? 12 : Math.max(2, Math.floor(strength / 4));
    context.lineCap = "round";
    context.lineJoin = "round";
    for (let index = 0; index < crackCount; index += 1) {
      const originX = ((index * 83 + Math.round(strength) * 29) % 470) + 20;
      const originY = ((index * 47 + Math.round(strength) * 11) % 120) + 20;
      context.beginPath();
      context.moveTo(originX, originY);
      context.lineTo(originX + (index % 2 === 0 ? 16 : -14), originY + 15);
      context.lineTo(originX + (index % 3 === 0 ? 28 : -25), originY + 30);
      context.strokeStyle =
        kind === "vitality"
          ? "#54ff8a"
          : kind === "time-slow"
            ? "#55cfff"
            : reinforced
              ? "#ff5a0a"
              : "#7c6650";
      context.lineWidth = reinforced || kind !== "standard" ? 5 : 2.2;
      context.shadowColor =
        kind === "vitality"
          ? "#54ff8a"
          : kind === "time-slow"
            ? "#55cfff"
            : reinforced
              ? "#ff7a13"
              : "transparent";
      context.shadowBlur = reinforced || kind !== "standard" ? 8 : 0;
      context.stroke();
    }
    context.shadowBlur = 0;

    const lowerShade = context.createLinearGradient(0, height * 0.45, 0, height);
    lowerShade.addColorStop(0, "rgba(0, 0, 0, 0)");
    lowerShade.addColorStop(1, "rgba(0, 0, 0, 0.34)");
    context.fillStyle = lowerShade;
    context.fillRect(0, 0, width, height);

    if (kind === "vitality") {
      this.#drawVitalityIcon(context, 70, height / 2);
    } else if (kind === "time-slow") {
      this.#drawClockIcon(context, 70, height / 2);
    }

    context.textAlign = "center";
    context.textBaseline = "middle";
    context.font = "900 84px Impact, Arial Black, sans-serif";
    context.lineWidth = 12;
    context.strokeStyle = reinforced ? "#1b0803" : "#3b2b20";
    const textX = kind === "standard" || kind === "super-heavy"
      ? width / 2
      : width / 2 + 34;
    context.strokeText(String(Math.round(strength)), textX, height / 2 + 4);
    context.fillStyle = "#ffffff";
    context.fillText(String(Math.round(strength)), textX, height / 2 + 4);
    texture.update(false);
  }

  #drawVitalityIcon(
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
  ): void {
    context.save();
    context.translate(x, y);
    context.beginPath();
    context.moveTo(0, 25);
    context.bezierCurveTo(-42, 0, -30, -34, 0, -13);
    context.bezierCurveTo(30, -34, 42, 0, 0, 25);
    context.closePath();
    context.fillStyle = "#f7fffa";
    context.shadowColor = "#54ff8a";
    context.shadowBlur = 12;
    context.fill();
    context.restore();
  }

  #drawClockIcon(
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
  ): void {
    context.save();
    context.translate(x, y);
    context.strokeStyle = "#0b4e82";
    context.fillStyle = "#f8fdff";
    context.lineWidth = 9;
    context.shadowColor = "#55cfff";
    context.shadowBlur = 12;
    context.beginPath();
    context.arc(0, 0, 31, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.shadowBlur = 0;
    context.beginPath();
    context.moveTo(0, -18);
    context.lineTo(0, 2);
    context.lineTo(17, 13);
    context.stroke();
    context.restore();
  }
}
