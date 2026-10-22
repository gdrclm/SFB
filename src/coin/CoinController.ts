import { prepareCoinMaterials, prepareCoinGeometry } from "./CoinResources";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { Scene } from "@babylonjs/core/scene";
import type { GameConfig } from "../config/gameConfig";

export interface CoinChain { remaining: number; cancelled: boolean; }

export class CoinController {
  public chain: CoinChain | null = null;
  public readonly mesh: Mesh;
  public readonly radius: number;
  #isActive = true;

  public constructor(
    scene: Scene,
    config: GameConfig,
    position: Readonly<{ x: number; y: number }>,
    index: number,
  ) {
    this.radius = config.coins.radius;
    const geometry = prepareCoinGeometry(scene, this.radius);
    this.mesh = geometry.body.clone(`coin-${String(index)}`, null, true);
    this.mesh.setEnabled(true);
    this.mesh.position.set(position.x, position.y, config.playSpace.depth);
    this.mesh.rotation.x = Math.PI / 2;
    this.mesh.isPickable = false;

    const { body: bodyMaterial, face: faceMaterial } = prepareCoinMaterials(scene);
    this.mesh.material = bodyMaterial;
    const face = geometry.face.clone(`coin-${String(index)}-face`, null, true);
    face.setEnabled(true);
    face.parent = this.mesh;
    face.position.y = -this.radius * 0.17;
    face.rotation.x = Math.PI / 2;
    face.material = faceMaterial;
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
