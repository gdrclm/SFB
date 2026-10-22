import type { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Scene } from "@babylonjs/core/scene";
import type { GameConfig } from "../config/gameConfig";
import {
  PlatformController,
  type PlatformActivationProperties,
} from "./PlatformController";

export class PlatformPool {
  public readonly platforms: readonly PlatformController[];
  readonly #available: PlatformController[] = [];

  public constructor(platforms: readonly PlatformController[]) {
    this.platforms = platforms;
    for (const platform of platforms) {
      if (!platform.isActive && !platform.isBreaking) {
        this.#available.push(platform);
      }
    }
  }

  public get availableCount(): number {
    return this.#available.length;
  }

  public release(platform: PlatformController): boolean {
    if (!this.beginRelease(platform)) {
      return false;
    }

    return this.completeRelease(platform);
  }

  public beginRelease(platform: PlatformController): boolean {
    if (!this.platforms.includes(platform)) {
      return false;
    }

    return platform.beginBreak();
  }

  public completeRelease(platform: PlatformController): boolean {
    if (!this.platforms.includes(platform) || !platform.finishBreak()) {
      return false;
    }

    this.#available.push(platform);
    return true;
  }

  public acquire(
    position?: Vector3,
    properties?: PlatformActivationProperties,
  ): PlatformController | null {
    const platform = this.#available.pop();
    if (platform === undefined) {
      return null;
    }

    if (properties === undefined) {
      platform.reactivate(position);
    } else {
      platform.reactivate(position, properties);
    }
    return platform;
  }

  public dispose(): void {
    this.#available.length = 0;
    for (const platform of this.platforms) {
      platform.dispose();
    }
  }
}

export function createStaticPlatformPool(scene: Scene, config: GameConfig): PlatformPool {
  const platforms: PlatformController[] = [];
  if (config.platforms.length === 0) {
    throw new Error("At least one platform template is required.");
  }

  for (let index = 0; index < config.platformGeneration.poolSize; index += 1) {
    const template = config.platforms[index % config.platforms.length];
    if (template === undefined) {
      throw new Error("Platform pool template is missing.");
    }

    const controller = new PlatformController(
      scene,
      config,
      index < config.platforms.length
        ? template
        : {
            ...template,
            id: `platform-pooled-${String(index)}`,
          },
      index < config.platforms.length,
    );
    platforms.push(controller);
  }

  return new PlatformPool(platforms);
}
