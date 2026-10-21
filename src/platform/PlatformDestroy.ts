import type { PlatformSpriteRow, SpriteRect } from "./PlatformSpriteLayout";

export const DESTROY_ATLAS_SIZE = { width: 1536, height: 1024 };
export const DESTROY_FRAME_COUNT = 12;
// Measured intact top rims: each reference row has different FX headroom.
export const DESTROY_RIM_Y = [95, 86, 79, 74, 60] as const;

/** One shot: clamp to the last pose rather than wrapping back to intact stone. */
export function destroySample(progress: number): { frame: number; nextFrame: number; blend: number; opacity: number } {
  const p = Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0;
  const position = p * (DESTROY_FRAME_COUNT - 1);
  const frame = Math.floor(position);
  return { frame, nextFrame: Math.min(DESTROY_FRAME_COUNT - 1, frame + 1), blend: position - frame,
    opacity: p < .88 ? 1 : (1 - p) / .12 };
}

export function destroySpriteRect(row: PlatformSpriteRow, frame: number): SpriteRect {
  const cellWidth = DESTROY_ATLAS_SIZE.width / DESTROY_FRAME_COUNT;
  const cellHeight = DESTROY_ATLAS_SIZE.height / 5;
  return { x: Math.max(0, Math.min(11, frame)) * cellWidth + 2, y: row * cellHeight + 2,
    width: cellWidth - 4, height: cellHeight - 4 };
}
