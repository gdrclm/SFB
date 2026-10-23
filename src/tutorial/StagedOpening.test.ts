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
  it("reveals the controls, coins, BOOST, danger, healing and trial ability before completion", () => {
    const { opening, events, random, complete } = fixture();
    opening.fixedUpdate(0);
    expect(events).toEqual(["spawn:platform", "tip:platform"]);
    opening.fixedUpdate(3.9); expect(random).not.toHaveBeenCalled();
    opening.fixedUpdate(0.1); expect(events.slice(-2)).toEqual(["spawn:coin", "tip:coin"]);
    opening.fixedUpdate(12); expect(events.slice(-2)).toEqual(["spawn:boost", "tip:boost"]);
    opening.fixedUpdate(7); expect(events.slice(-2)).toEqual(["spawn:fork", "tip:fork"]);
    opening.fixedUpdate(6); expect(events.slice(-2)).toEqual(["spawn:vitality", "tip:vitality"]);
    opening.fixedUpdate(6); expect(events.slice(-2)).toEqual(["spawn:time-slow", "tip:time-slow"]);
    opening.fixedUpdate(6); expect(events.slice(-2)).toEqual(["spawn:ability", "tip:ability"]);
    opening.fixedUpdate(6); expect(events.slice(-2)).toEqual(["spawn:abilities", "tip:abilities"]);
    opening.fixedUpdate(5); expect(events.slice(-2)).toEqual(["spawn:annihilation", "tip:annihilation"]);
    opening.fixedUpdate(6);
    expect(random).not.toHaveBeenCalled();
    expect(events.filter((event) => event === "spawn:practice")).toHaveLength(6);
    expect(complete).toHaveBeenCalledOnce();
    opening.fixedUpdate(100);
    expect(random).not.toHaveBeenCalled();
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

  it("explains real life loss and visible types once, and never prompts after lessons end", () => {
    const { opening, events } = fixture();
    opening.fixedUpdate(0);
    expect(events).not.toContain("tip:life");
    opening.discover("life"); opening.discover("life");
    expect(events.filter(event => event === "tip:life")).toHaveLength(1);
    opening.platformAppeared("vitality"); opening.platformAppeared("vitality");
    expect(events.filter(event => event === "tip:vitality")).toHaveLength(1);
    for (let i = 0; i < 3500; i++) opening.fixedUpdate(.02);
    const count = events.length;
    opening.platformAppeared("time-slow"); opening.discover("combo");
    expect(events).toHaveLength(count);
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

it("waits for a legitimately earned BOOST and offers practice instead of an impossible gate", () => {
  let ready = false;
  const events: string[] = [];
  const opening = new StagedOpening({ spawn: (kind) => { events.push(kind); },
    explain: vi.fn(), random: vi.fn(), complete: vi.fn(), readyForBoost: () => ready });
  for (let i = 0; i < 1200; i++) opening.fixedUpdate(.02);
  expect(events).not.toContain("boost"); expect(events).not.toContain("fork");
  expect(events.filter(e => e === "practice").length).toBeGreaterThanOrEqual(6);
  ready = true; opening.fixedUpdate(.02);
  expect(events.at(-1)).toBe("boost");
  opening.fixedUpdate(6); expect(events).not.toContain("fork");
  opening.fixedUpdate(1); expect(events).toContain("fork");
});


it("demonstrates both abilities and ends automatically without any keyboard or ability gate", () => {
  const spawn = vi.fn(), complete = vi.fn(), random = vi.fn();
  const opening = new StagedOpening({ spawn, explain: vi.fn(), complete, random });
  for (let i = 0; i < 3500; i++) opening.fixedUpdate(.02);
  expect(spawn).toHaveBeenCalledWith("time-slow");
  expect(spawn).toHaveBeenCalledWith("ability");
  expect(spawn).toHaveBeenCalledWith("ability-demo");
  expect(spawn).toHaveBeenCalledWith("abilities");
  expect(spawn).toHaveBeenCalledWith("annihilation-demo");
  expect(complete).toHaveBeenCalledOnce(); expect(random).not.toHaveBeenCalled();
  expect(opening.isScripted).toBe(false);
});
