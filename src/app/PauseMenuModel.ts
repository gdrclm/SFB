export interface MissionProgress {
  readonly current: number;
  readonly target: number;
  readonly ratio: number;
  readonly label: string;
}

export interface PauseMenuSummary {
  readonly depthLabel: string;
  readonly coinLabel: string;
  readonly coinsMission: MissionProgress;
  readonly platformsMission: MissionProgress;
  readonly stageMission: MissionProgress;
}

export interface PauseMenuSummaryInput {
  readonly depth: number;
  readonly coins: number;
  readonly destroyedPlatforms: number;
  readonly stage: number;
  readonly stageTarget: number;
  readonly coinTarget: number;
  readonly platformTarget: number;
}

function createMissionProgress(value: number, target: number): MissionProgress {
  const safeTarget = Math.max(1, Math.floor(target));
  const current = Math.min(safeTarget, Math.max(0, Math.floor(value)));

  return {
    current,
    target: safeTarget,
    ratio: current / safeTarget,
    label: `${String(current)}/${String(safeTarget)}`,
  };
}

export function createPauseMenuSummary(
  input: PauseMenuSummaryInput,
): PauseMenuSummary {
  const depth = Number.isFinite(input.depth) ? Math.max(0, input.depth) : 0;
  const coins = Number.isFinite(input.coins) ? Math.max(0, Math.floor(input.coins)) : 0;

  return {
    depthLabel: `${depth.toFixed(0)} М`,
    coinLabel: String(coins),
    coinsMission: createMissionProgress(coins, input.coinTarget),
    platformsMission: createMissionProgress(
      input.destroyedPlatforms,
      input.platformTarget,
    ),
    stageMission: createMissionProgress(input.stage, input.stageTarget),
  };
}
