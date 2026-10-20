import type { PlatformKind } from "../config/gameConfig";
import type { ApproachState } from "./PlatformReadability";

export const PLATFORM_ATLAS_SIZE = { width: 1484, height: 1060 };
export interface SpriteRect { readonly x: number; readonly y: number; readonly width: number; readonly height: number; }
export type PlatformSpriteRow = 0 | 1 | 2 | 3 | 4;

/** Materials retain their identity; orange/red are active cues on ordinary stone. */
export function platformSpriteRow(kind: PlatformKind, state: ApproachState | null): PlatformSpriteRow {
  if (kind === "vitality") return 3;
  if (kind === "time-slow") return 4;
  if (state === "danger") return 2;
  if (state === "boost") return 1;
  if (state === "breakable") return 0;
  return 0;
}

export function platformSpriteRect(row: PlatformSpriteRow, frame: number): SpriteRect {
  // Three assembled poses, including their complete underside stones and glow.
  const x = [552, 788, 1028][Math.abs(Math.floor(frame)) % 3] ?? 552;
  const y = [58, 248, 444, 638, 828][row] ?? 58;
  return { x, y, width: 244, height: [152, 152, 152, 170, 186][row] ?? 152 };
}

export function debrisSpriteRect(row: PlatformSpriteRow, index: number): SpriteRect {
  // Individual large shards from the last atlas column, not a stretched platform face.
  const pieces = [
    { x: 1280, y: 104, width: 75, height: 76 },
    { x: 1354, y: 83, width: 49, height: 53 },
    { x: 1340, y: 133, width: 57, height: 53 },
    { x: 1400, y: 101, width: 58, height: 56 },
  ];
  const piece = pieces[Math.abs(Math.floor(index)) % pieces.length] ?? pieces[0];
  if (piece === undefined) throw new Error("Missing sprite shard");
  const offset = [0, 174, 374, 579, 771][row] ?? 0;
  return { ...piece, y: piece.y + offset };
}

export interface PlatformSpriteSlice { readonly left: number; readonly right: number; readonly rect: SpriteRect; }
/** Fixed-size end caps and repeated middle pieces avoid stretching the rock on wide lanes. */
export function platformSpriteSlices(width: number, rect: SpriteRect): readonly PlatformSpriteSlice[] {
  const cap = Math.min(.72, width / 3);
  const middle = width - cap * 2;
  const count = Math.max(1, Math.ceil(middle / 1.35));
  const left = -width / 2;
  const slices: PlatformSpriteSlice[] = [{ left, right: left + cap, rect: { ...rect, width: 69 } }];
  for (let i = 0; i < count; i++) slices.push({
    left: left + cap + middle * i / count, right: left + cap + middle * (i + 1) / count,
    rect: { ...rect, x: rect.x + 69, width: 106 },
  });
  slices.push({ left: width / 2 - cap, right: width / 2, rect: { ...rect, x: rect.x + 175, width: 69 } });
  return slices;
}
