import { describe, expect, it, vi } from "vitest";
import { FixedStepRunner } from "../core/FixedStepRunner";
import { StagedOpening, type GuideTip } from "./StagedOpening";

function fixture() {
  const events: string[] = [];
  const random = vi.fn(() => { events.push("random"); });
  const complete = vi.fn();
  const opening = new StagedOpening({
    spawn: (kind) => { events.push(`spawn:${kind}`); },
    explain: (tip) => { events.push(`tip:${tip}`); }, random, complete,
  });
  return { opening, events, random, complete };
}

describe("staged opening", () => {
  it("reveals platform, coin, boost gate, then fork before random challenges", () => {
    const { opening, events, random, complete } = fixture();
    opening.fixedUpdate(0);
    expect(events).toEqual(["spawn:platform", "tip:platform"]);
    opening.fixedUpdate(3.9); expect(random).not.toHaveBeenCalled();
    opening.fixedUpdate(0.1); expect(events.slice(-2)).toEqual(["spawn:coin", "tip:coin"]);
    opening.fixedUpdate(6); expect(events.slice(-2)).toEqual(["spawn:boost", "tip:boost"]);
    opening.fixedUpdate(8); expect(events.slice(-2)).toEqual(["spawn:fork", "tip:fork"]);
    opening.fixedUpdate(11.9); expect(random).not.toHaveBeenCalled();
    opening.fixedUpdate(0.1);
    expect(events.slice(-2)).toEqual(["random", "tip:free"]);
    expect(events.filter((event) => event === "spawn:practice")).toHaveLength(3);
    expect(complete).toHaveBeenCalledOnce();
    opening.fixedUpdate(100);
    expect(random).toHaveBeenCalledOnce();
  });

  it("stops catch-up simulation immediately for an explanation and resumes without jumping", () => {
    let paused = false;
    const movement = vi.fn();
    const opening = new StagedOpening({ spawn: vi.fn(), random: vi.fn(), complete: vi.fn(),
      explain: () => { paused = true; } });
    const runner = new FixedStepRunner(0.02, 0.2);
    runner.register(opening); runner.register({ fixedUpdate: movement });
    runner.advance(0.2, 1, () => !paused);
    expect(paused).toBe(true);
    expect(movement).not.toHaveBeenCalled();
    expect(opening.elapsed).toBe(0.02);
    runner.advance(0.2, 1, () => !paused);
    expect(opening.elapsed).toBe(0.02);
    paused = false;
    runner.advance(0.02, 1, () => !paused);
    expect(movement).toHaveBeenCalledOnce();
    expect(opening.elapsed).toBe(0.04);
  });

  it("explains loss of life only on a real event and new types only when they appear", () => {
    const { opening, events } = fixture();
    opening.fixedUpdate(0); opening.platformAppeared("vitality");
    expect(events).not.toContain("tip:life");
    expect(events).not.toContain("tip:vitality");
    opening.discover("life"); opening.discover("life");
    expect(events.filter((event) => event === "tip:life")).toHaveLength(1);
    opening.fixedUpdate(4); opening.fixedUpdate(6); opening.fixedUpdate(8); opening.fixedUpdate(12);
    for (const kind of ["vitality", "time-slow"] as const) {
      opening.platformAppeared(kind); opening.platformAppeared(kind);
      expect(events.filter((event) => event === `tip:${kind}`)).toHaveLength(1);
    }
    opening.platformAppeared("super-heavy");
    expect(events).toContain("tip:fork");
    expect(events).not.toContain("tip:super-heavy");
  });

  it("skips staging once and stops all later contextual prompts", () => {
    const { opening, events, random, complete } = fixture();
    opening.fixedUpdate(0); opening.skip(); opening.skip();
    expect(opening.isScripted).toBe(false);
    const count = events.length;
    for (const tip of ["coin", "life", "combo", "vitality"] as GuideTip[]) opening.discover(tip);
    opening.fixedUpdate(30);
    expect(events).toHaveLength(count);
    expect(random).toHaveBeenCalledOnce();
    expect(complete).toHaveBeenCalledOnce();
  });
});
