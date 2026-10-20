export const MISSION_REWARD = 10;
export interface MissionState { readonly index: number; readonly progress: number; }
export type MissionEvent = { readonly type: "hit"; readonly combo: number } |
  { readonly type: "coin" | "boost" | "life-lost" | "run-start" };
type MissionKind = "clean" | "coins" | "boosts" | "platforms" | "combo";
export function currentMission(state: MissionState): { kind: MissionKind; target: number; title: string } {
  const round = Math.min(5, Math.floor(state.index / 5));
  switch (state.index % 5) {
    case 0: return { kind: "clean", target: 5 + round, title: `Разбейте ${String(5 + round)} без потери жизни` };
    case 1: return { kind: "coins", target: 5 + round * 2, title: `Соберите ${String(5 + round * 2)} монет` };
    case 2: return { kind: "boosts", target: Math.min(4, 2 + round), title: `Используйте BOOST ${String(Math.min(4, 2 + round))} раза` };
    case 3: return { kind: "platforms", target: 8 + round * 2, title: `Разбейте ${String(8 + round * 2)} платформ` };
    default: return { kind: "combo", target: 6 + round, title: `Соберите комбо из ${String(6 + round)} ударов` };
  }
}
/** One event belongs to the active mission only; past actions never complete the next one. */
export function advanceMission(state: MissionState, event: MissionEvent): { state: MissionState; completed: boolean } {
  const mission = currentMission(state);
  let progress = state.progress;
  if ((event.type === "life-lost" || event.type === "run-start") && (mission.kind === "clean" || mission.kind === "combo")) progress = 0;
  if (event.type === "hit") {
    if (mission.kind === "clean" || mission.kind === "platforms") progress++;
    if (mission.kind === "combo") progress = Math.min(progress + 1, event.combo);
  }
  if (event.type === "coin" && mission.kind === "coins") progress++;
  if (event.type === "boost" && mission.kind === "boosts") progress++;
  const completed = progress >= mission.target;
  return { state: completed ? { index: state.index + 1, progress: 0 } : { index: state.index, progress }, completed };
}
