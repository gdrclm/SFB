import { expect, it } from "vitest";
import { advanceMission, currentMission, type MissionState } from "./Missions";
it("advances to a different goal, counts only new matching actions and continues after a cycle", () => {
  let state: MissionState = { index: 0, progress: 4 };
  let result = advanceMission(state, { type: "hit", combo: 5 });
  expect(result).toEqual({ state: { index: 1, progress: 0 }, completed: true });
  state = result.state;
  expect(advanceMission(state, { type: "hit", combo: 6 }).state).toEqual(state);
  for (let i = 0; i < 5; i++) { result = advanceMission(state, { type: "coin" }); state = result.state; }
  expect(state).toEqual({ index: 2, progress: 0 });
  for (let i = 0; i < 2; i++) state = advanceMission(state, { type: "boost" }).state;
  expect(state.index).toBe(3);
  for (let i = 0; i < 8; i++) state = advanceMission(state, { type: "hit", combo: i + 1 }).state;
  expect(state).toEqual({ index: 4, progress: 0 });
  state = advanceMission(state, { type: "hit", combo: 9 }).state;
  expect(state).toEqual({ index: 4, progress: 1 });
  for (let i = 0; i < 5; i++) state = advanceMission(state, { type: "hit", combo: 10 + i }).state;
  expect(state).toEqual({ index: 5, progress: 0 });
  expect(currentMission(state)).toMatchObject({ kind: "clean", target: 6 });
  expect(currentMission({ index: 1000, progress: 0 }).target).toBe(10);
});
it("resets streak goals on life loss or run restart but retains cumulative goals", () => {
  for (const type of ["life-lost", "run-start"] as const) {
    for (const index of [0, 4]) expect(advanceMission({ index, progress: 4 }, { type }).state.progress).toBe(0);
    for (const index of [1, 2, 3]) expect(advanceMission({ index, progress: 1 }, { type }).state.progress).toBe(1);
  }
});
