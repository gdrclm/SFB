import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import type { Scene } from "@babylonjs/core/scene";
import type { GameConfig } from "../config/gameConfig";

export interface CoinChain { remaining: number; cancelled: boolean; }

export class CoinController {
  public chain: CoinChain | null = null;
  public readonly mesh: Mesh;
  public readonly radius: number;
  readonly #material: StandardMaterial;
  readonly #faceMaterial: StandardMaterial;
  readonly #faceTexture: DynamicTexture | null;
  #isActive = true;

  public constructor(
    scene: Scene,
    config: GameConfig,
    position: Readonly<{ x: number; y: number }>,
    index: number,
  ) {
    this.radius = config.coins.radius;
    this.mesh = MeshBuilder.CreateCylinder(
      `coin-${String(index)}`,
      {
        diameter: this.radius * 2,
        height: this.radius * 0.28,
        tessellation: 24,
      },
      scene,
    );
    this.mesh.position.set(position.x, position.y, config.playSpace.depth);
    this.mesh.rotation.x = Math.PI / 2;
    this.mesh.isPickable = false;

    this.#material = new StandardMaterial(`coin-${String(index)}-material`, scene);
    this.#material.diffuseColor = new Color3(1, 0.61, 0.01);
    this.#material.emissiveColor = new Color3(0.35, 0.12, 0.005);
    this.#material.specularColor = new Color3(1, 0.88, 0.32);
    this.#material.specularPower = 48;
    this.mesh.material = this.#material;

    this.#faceTexture =
      typeof OffscreenCanvas !== "undefined" || typeof document !== "undefined"
        ? new DynamicTexture(
            `coin-${String(index)}-face-texture`,
            { width: 128, height: 128 },
            scene,
            false,
          )
        : null;
    if (this.#faceTexture !== null) {
      const context = this.#faceTexture.getContext() as unknown as CanvasRenderingContext2D;
      context.clearRect(0, 0, 128, 128);
      const gradient = context.createRadialGradient(48, 38, 8, 64, 64, 58);
      gradient.addColorStop(0, "#fff9a6");
      gradient.addColorStop(0.55, "#ffc400");
      gradient.addColorStop(1, "#d36a00");
      context.fillStyle = gradient;
      context.beginPath();
      context.arc(64, 64, 60, 0, Math.PI * 2);
      context.fill();
      context.lineWidth = 7;
      context.strokeStyle = "#7b3500";
      context.stroke();
      context.font = "900 74px Arial Black, sans-serif";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.lineWidth = 8;
      context.strokeStyle = "#9b4c00";
      context.strokeText("★", 64, 66);
      context.fillStyle = "#fff07a";
      context.fillText("★", 64, 66);
      this.#faceTexture.update(false);
    }

    this.#faceMaterial = new StandardMaterial(
      `coin-${String(index)}-face-material`,
      scene,
    );
    if (this.#faceTexture !== null) {
      this.#faceMaterial.diffuseTexture = this.#faceTexture;
    } else {
      this.#faceMaterial.diffuseColor = new Color3(1, 0.75, 0.04);
    }
    this.#faceMaterial.emissiveColor = new Color3(0.3, 0.12, 0);
    this.#faceMaterial.specularColor = new Color3(1, 0.85, 0.25);
    this.#faceMaterial.backFaceCulling = false;
    const face = MeshBuilder.CreateDisc(
      `coin-${String(index)}-face`,
      { radius: this.radius * 0.88, tessellation: 32 },
      scene,
    );
    face.parent = this.mesh;
    face.position.y = -this.radius * 0.17;
    face.rotation.x = Math.PI / 2;
    face.material = this.#faceMaterial;
    face.isPickable = false;
  }

  public get isActive(): boolean {
    return this.#isActive;
  }

  public collect(): boolean {
    if (!this.#isActive) {
      return false;
    }

    this.#isActive = false;
    if (this.chain !== null) this.chain.remaining -= 1;
    this.mesh.setEnabled(false);
    return true;
  }

  public deactivate(): void {
    if (this.#isActive && this.chain !== null) this.chain.cancelled = true;
    this.#isActive = false;
    this.mesh.setEnabled(false);
  }

  public reactivate(position: Readonly<{ x: number; y: number }>): boolean {
    if (this.#isActive) {
      return false;
    }

    this.chain = null;
    this.mesh.position.x = position.x;
    this.mesh.position.y = position.y;
    this.mesh.setEnabled(true);
    this.#isActive = true;
    return true;
  }

  public dispose(): void {
    this.mesh.dispose();
    this.#faceTexture?.dispose();
    this.#faceMaterial.dispose();
    this.#material.dispose();
  }
}

export function createCoins(scene: Scene, config: GameConfig): CoinController[] {
  return Array.from({ length: config.coins.poolSize }, (_, index) => {
    const position = config.coins.positions[index] ?? { x: 0, y: 0 };
    const coin = new CoinController(scene, config, position, index);
    if (index >= config.coins.positions.length) {
      coin.deactivate();
    }
    return coin;
  });
}
