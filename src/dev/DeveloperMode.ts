import type { GameConfig } from "../config/gameConfig";

export const DEVELOPER_MODE_KEY = "speed-fall-ball.developer-mode";
export const DEVELOPER_DEPTH_KEY = "speed-fall-ball.developer-depth";
export const MAX_START_DEPTH = 1000000;

export function parseStartDepth(value: string): number | null {
  if (value.trim() === "") return null;
  const depth = Number(value);
  return Number.isSafeInteger(depth) && depth >= 0 && depth <= MAX_START_DEPTH ? depth : null;
}

/** Move the whole initial playfield together so generators continue below the player. */
export function atStartDepth(config: GameConfig, depth: number): GameConfig {
  if (depth === 0) return config;
  return {
    ...config,
    startDepth: depth,
    ball: { ...config.ball, startPosition: { ...config.ball.startPosition, y: config.ball.startPosition.y - depth } },
    platforms: config.platforms.map(platform => ({ ...platform, position: { ...platform.position, y: platform.position.y - depth } })),
    coins: { ...config.coins, positions: config.coins.positions.map(position => ({ ...position, y: position.y - depth })) },
  };
}
