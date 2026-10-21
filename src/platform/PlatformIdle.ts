import type { PlatformSpriteRow, SpriteRect } from "./PlatformSpriteLayout";

export const IDLE_FRAME_COUNT = 12;
export const IDLE_FPS = 12;
export const IDLE_ATLAS_SIZE = { width: 1942, height: 809 };

/** The simulation supplies a frozen clock in pause and zero for reduced motion. */
export function idleFrame(elapsed: number, phase = 0): number {
  if (!Number.isFinite(elapsed) || elapsed <= 0) return 0;
  const cycles = elapsed * IDLE_FPS / IDLE_FRAME_COUNT + phase;
  return Math.floor(((cycles % 1 + 1) % 1) * IDLE_FRAME_COUNT + 1e-8) % IDLE_FRAME_COUNT;
}

export function idlePhase(id: string): number {
  let hash = 0;
  for (const character of id) hash = (Math.imul(hash, 31) + character.charCodeAt(0)) >>> 0;
  return (hash % IDLE_FRAME_COUNT) / IDLE_FRAME_COUNT;
}

export function idleSpriteRect(row: PlatformSpriteRow, frame: number): SpriteRect {
  const column = ((Math.floor(frame) % IDLE_FRAME_COUNT) + IDLE_FRAME_COUNT) % IDLE_FRAME_COUNT;
  const cellWidth = IDLE_ATLAS_SIZE.width / IDLE_FRAME_COUNT;
  const cellHeight = IDLE_ATLAS_SIZE.height / 5;
  // A one-pixel inset stops bilinear sampling from picking up an adjacent pose.
  return { x: column * cellWidth + 1, y: row * cellHeight + 1, width: cellWidth - 2, height: cellHeight - 2 };
}
