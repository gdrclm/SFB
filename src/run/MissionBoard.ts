import { currentMission, type MissionState } from "./Missions";

export interface MissionBoard {
  readonly start: number;
  readonly selected: number | null;
  readonly progress: readonly number[];
  readonly completed: readonly boolean[];
}

export function migrateMissionBoard(mission: MissionState): MissionBoard {
  const offset = mission.index % 5;
  return { start: mission.index - offset, selected: offset,
    progress: Array.from({ length: 5 }, (_, i) => i === offset ? mission.progress : 0),
    completed: Array.from({ length: 5 }, (_, i) => i < offset) };
}

export function parseMissionBoard(value: unknown, legacy: MissionState): MissionBoard {
  const fallback = migrateMissionBoard(legacy);
  if (typeof value !== "object" || value === null) return fallback;
  const board = value as Record<string, unknown>;
  if (typeof board.start !== "number" || !Number.isSafeInteger(board.start) || board.start < 0 ||
    board.start % 5 !== 0 || board.start > Number.MAX_SAFE_INTEGER - 10 ||
    !Array.isArray(board.progress) || board.progress.length !== 5 ||
    !Array.isArray(board.completed) || board.completed.length !== 5 ||
    !board.completed.every((v) => typeof v === "boolean")) return fallback;
  const start = board.start;
  const progress: unknown[] = board.progress;
  if (!progress.every((v, i) => typeof v === "number" && Number.isSafeInteger(v) && v >= 0 &&
    v < currentMission({ index: start + i, progress: 0 }).target)) return fallback;
  const completed = board.completed;
  const selected = board.selected;
  if (selected !== null && (typeof selected !== "number" || !Number.isInteger(selected) ||
    selected < 0 || selected >= 5 || completed[selected])) return fallback;
  return { start, selected, progress: progress as number[], completed };
}
