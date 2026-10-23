import { expect, it, vi } from "vitest";
import { type Challenge, ChallengeDirector } from "./ChallengeDirector";
it("introduces different physical encounter themes every 20–40 simulation seconds", () => {
  const start = vi.fn<(challenge: Challenge) => void>(); let random = 0;
  const director = new ChallengeDirector(start, () => { const value = random; random = 1 - random; return value; });
  director.fixedUpdate(19.99); expect(start).not.toHaveBeenCalled();
  director.fixedUpdate(.01); expect(start.mock.calls[0]?.[0].theme).toBe("rich-lane");
  director.fixedUpdate(39.99); expect(start).toHaveBeenCalledTimes(1);
  director.fixedUpdate(.01); expect(start.mock.calls[1]?.[0].theme).toBe("trap");
  director.fixedUpdate(20); expect(start.mock.calls[2]?.[0].theme).toBe("bait");
});

it("increases physical challenge frequency during a long run without removing reaction gaps", () => {
  const events: number[] = []; let time = 0;
  const director = new ChallengeDirector(() => { events.push(time); }, () => 1);
  for (time = 1; time <= 260; time++) director.fixedUpdate(1);
  expect(events.slice(0, 3)).toEqual([40, 80, 120]);
  expect(events.slice(3, 6)).toEqual([150, 180, 210]);
  expect(events.slice(6)).toEqual([235, 260]);
});
