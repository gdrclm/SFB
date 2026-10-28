import { describe, expect, it } from "vitest";
import { gameConfig } from "../config/gameConfig";
import { FixedStepRunner } from "../core/FixedStepRunner";
import type { HorizontalInput } from "../input/HorizontalInput";
import { BallController } from "./BallController";

function createTransform(): { position: { x: number; y: number; z: number } } {
  return { position: { x: 0, y: 0, z: 0 } };
}

function createInput(isActive = false, normalizedPosition = 0): HorizontalInput {
  return { isActive, normalizedPosition };
}

function simulate(controller: BallController, seconds: number, frequency: number): void {
  const step = 1 / frequency;
  for (let index = 0; index < seconds * frequency; index += 1) {
    controller.fixedUpdate(step);
  }
}

describe("BallController", () => {
  it("starts at the configured position and fall speed", () => {
    const transform = createTransform();
    const controller = new BallController(transform, createInput(), gameConfig);

    expect(transform.position).toEqual({ x: 0, y: 4.5, z: 0 });
    expect(controller.fallSpeed).toBe(10);
  });

  it("falls continuously and applies natural acceleration", () => {
    const transform = createTransform();
    const controller = new BallController(transform, createInput(), gameConfig);

    simulate(controller, 1, 60);

    expect(transform.position.y).toBeLessThan(1.15);
    expect(controller.fallSpeed).toBeCloseTo(10.25, 10);
  });

  it("keeps the previous and current positions for swept collision checks", () => {
    const transform = createTransform();
    const controller = new BallController(transform, createInput(), gameConfig);
    const initialPosition = { ...controller.position };

    controller.fixedUpdate(1 / 60);

    expect(controller.previousPosition).toEqual(initialPosition);
    expect(controller.position.y).toBeLessThan(controller.previousPosition.y);
  });

  it("produces the same movement at different fixed frequencies", () => {
    const transform50 = createTransform();
    const transform100 = createTransform();
    const controller50 = new BallController(transform50, createInput(true, 0.75), gameConfig);
    const controller100 = new BallController(transform100, createInput(true, 0.75), gameConfig);

    simulate(controller50, 1, 50);
    simulate(controller100, 1, 100);

    expect(transform50.position.x).toBeCloseTo(transform100.position.x, 1);
    expect(transform50.position.y).toBeCloseTo(transform100.position.y, 1);
  });

  it("keeps the complete ball inside horizontal boundaries", () => {
    const transform = createTransform();
    const controller = new BallController(transform, createInput(true, 1), gameConfig);

    simulate(controller, 5, 60);

    expect(transform.position.x).toBeCloseTo(
      gameConfig.playSpace.halfWidth - gameConfig.ball.radius,
      10,
    );
    expect(controller.horizontalVelocity).toBeCloseTo(0, 10);
  });

  it("keeps a short inertia after pointer release", () => {
    const transform = createTransform();
    const input = { isActive: true, normalizedPosition: 1 };
    const controller = new BallController(transform, input, gameConfig);
    simulate(controller, 0.2, 60);
    const positionAtRelease = transform.position.x;

    input.isActive = false;
    simulate(controller, 0.1, 60);

    expect(transform.position.x).toBeGreaterThan(positionAtRelease);
    expect(controller.horizontalVelocity).toBeGreaterThan(0);
  });

  it("responds on the first simulation tick", () => {
    const transform = createTransform();
    const controller = new BallController(
      transform,
      createInput(true, 1),
      gameConfig,
    );

    controller.fixedUpdate(1 / 60);

    expect(transform.position.x).toBeGreaterThan(0);
    expect(controller.horizontalVelocity).toBeGreaterThan(0);
  });

  it("keeps horizontal response in real time during ten-percent game time", () => {
    const normalTransform = createTransform();
    const slowTransform = createTransform();
    const normalController = new BallController(
      normalTransform,
      createInput(true, 1),
      gameConfig,
    );
    const slowController = new BallController(
      slowTransform,
      createInput(true, 1),
      gameConfig,
    );
    const normalRunner = new FixedStepRunner(1 / 60, 0.25);
    const slowRunner = new FixedStepRunner(1 / 60, 0.25);
    normalRunner.register(normalController);
    slowRunner.register(slowController);

    for (let frame = 0; frame < 6; frame += 1) {
      normalRunner.advance(1 / 60);
      slowRunner.advance(1 / 60, 0.1);
    }

    expect(slowTransform.position.x).toBeCloseTo(normalTransform.position.x, 10);
    expect(slowController.horizontalVelocity).toBeCloseTo(
      normalController.horizontalVelocity,
      10,
    );
    expect(slowTransform.position.y).toBeGreaterThan(normalTransform.position.y);
  });

  it("rejects invalid controlled fall speeds", () => {
    const controller = new BallController(createTransform(), createInput(), gameConfig);

    expect(() => {
      controller.fallSpeed = -1;
    }).toThrow(RangeError);
  });

  it("briefly resists a break without stopping the fall or horizontal steering", () => {
    const transform = createTransform(), controller = new BallController(transform, createInput(true, 1), gameConfig);
    controller.fallSpeed = 29;
    controller.startBreakImpact(-5, .9);
    controller.fixedUpdate(1 / 60);
    expect(transform.position.y).toBeLessThan(-5);
    expect(controller.verticalVelocity).toBeLessThan(-7.5);
    expect(transform.position.x).toBeGreaterThan(0);
    simulate(controller, .08, 60);
    expect(transform.position.y).toBeLessThan(-5);
    expect(transform.position.y).toBeGreaterThan(-6);
    simulate(controller, .2, 60);
    expect(controller.verticalVelocity).toBeCloseTo(-controller.fallSpeed * gameConfig.ball.movementScale, 8);
  });

  it("converts incoming speed into rebound height and passes through an apex before falling", () => {
    const peak = (speed: number, frequency: number): number => {
      const transform = createTransform(), controller = new BallController(transform, createInput(), gameConfig);
      controller.fallSpeed = speed; controller.startBounce(0);
      let highest = 0, up = false, down = false;
      for (let i = 0; i < Math.round(gameConfig.unsuccessfulHit.bounceDurationSeconds * frequency); i++) {
        controller.fixedUpdate(1 / frequency);
        highest = Math.max(highest, transform.position.y);
        up ||= controller.verticalVelocity > 0; down ||= controller.verticalVelocity < 0;
        expect(transform.position.y).toBeGreaterThanOrEqual(0);
      }
      expect(up && down).toBe(true);
      expect(controller.verticalVelocity).toBeCloseTo(-gameConfig.ball.startFallSpeed * gameConfig.ball.movementScale, 8);
      return highest;
    };
    expect(peak(60, 60)).toBeGreaterThan(peak(10, 60) * 1.4);
    expect(peak(60, 60)).toBeCloseTo(peak(60, 120), 2);
  });

  it("bounces upward, resets speed and then returns to falling", () => {
    const transform = createTransform();
    const controller = new BallController(transform, createInput(), gameConfig);
    const contactY = 1.65;
    controller.fallSpeed = 24;

    expect(controller.startBounce(contactY)).toBe(true);
    expect(controller.startBounce(contactY)).toBe(false);
    expect(controller.fallSpeed).toBe(gameConfig.ball.startFallSpeed);
    expect(controller.isBouncing).toBe(true);

    controller.fixedUpdate(1 / 60);
    expect(transform.position.y).toBe(contactY);
    simulate(controller, 3 / 60, 60);
    expect(transform.position.y).toBeGreaterThan(contactY);

    simulate(
      controller,
      gameConfig.unsuccessfulHit.bounceDurationSeconds - 4 / 60,
      60,
    );
    expect(controller.isBouncing).toBe(false);
    expect(controller.fallSpeed).toBe(gameConfig.ball.startFallSpeed);

    const bounceTop = transform.position.y;
    controller.fixedUpdate(1 / 60);
    expect(transform.position.y).toBeLessThan(bounceTop);
  });
});

it("preserves purchased impact speed through the entire bounce, while the base game still resets it", () => {
  for (const retention of [0, .25, .5, .75]) {
    const ball = new BallController(createTransform(), createInput(), { ...gameConfig, powers: { ...gameConfig.powers, impactRetention: retention } });
    ball.fallSpeed = 100;
    expect(ball.startBounce(0)).toBe(true);
    expect(ball.fallSpeed).toBe(10 + 90 * retention);
    simulate(ball, gameConfig.unsuccessfulHit.bounceDurationSeconds, 60);
    expect(ball.fallSpeed).toBeCloseTo(10 + 90 * retention);
    expect(ball.isBouncing).toBe(false);
  }
});

it("caps direct mouse and touch targets without smoothing or banking pointer events", () => {
  const input = { isActive: true, normalizedPosition: 1, isImmediate: true };
  const ball = new BallController(createTransform(), input, gameConfig);
  for (let i = 0; i < 1000; i++) input.normalizedPosition = i % 2 === 0 ? -1 : 1;
  expect(ball.position.x).toBe(0);
  ball.fixedUpdate(1 / 240);
  expect(ball.position.x).toBeCloseTo(16 / 240);
  expect(ball.previousPosition.x).toBe(0);
  expect(ball.horizontalVelocity).toBeCloseTo(16);
  input.normalizedPosition = -1; ball.fixedUpdate(1 / 240);
  expect(ball.position.x).toBeCloseTo(0);
  expect(ball.horizontalVelocity).toBeCloseTo(-16);
  input.isActive = false; ball.fixedUpdate(1 / 60);
  expect(ball.horizontalVelocity).toBe(0);
});

it.each([30, 60, 240])("preserves screen traversal speed across wide viewports and slow motion at %s ticks", fps => {
  const distances: number[] = [];
  const config = { ...gameConfig, ball: { ...gameConfig.ball, naturalAcceleration: 0 } };
  for (const halfWidth of [5, 18, 48]) for (const timeScale of [1, .1]) {
    const ball = new BallController(createTransform(), { isActive: true, isImmediate: true, normalizedPosition: 1 }, config);
    ball.setPlayfieldHalfWidth(halfWidth);
    for (let i = 0; i < fps / 10; i++) ball.fixedUpdate(timeScale / fps, 1 / fps);
    distances.push(ball.position.x / ball.horizontalLimit);
  }
  for (const distance of distances) expect(distance).toBeCloseTo(16 * .1 / 4.5, 8);
});

it("tracks the cursor faster after boosts, stays bounded and reacts immediately to reversal and slowing", () => {
  const input = { isActive: true, isImmediate: true, normalizedPosition: 1 };
  const config = { ...gameConfig, ball: { ...gameConfig.ball, naturalAcceleration: 0 } };
  const ball = new BallController(createTransform(), input, config);
  ball.setPlayfieldHalfWidth(48);
  ball.fixedUpdate(1 / 60);
  const initialStep = ball.position.x;
  ball.fallSpeed = 40;
  ball.fixedUpdate(1 / 60);
  expect(ball.position.x - initialStep).toBeCloseTo(initialStep * 2);
  input.normalizedPosition = -1;
  const beforeReverse = ball.position.x;
  ball.fixedUpdate(1 / 60);
  expect(beforeReverse - ball.position.x).toBeCloseTo(initialStep * 2);
  ball.fallSpeed = 10;
  const beforeSlow = ball.position.x;
  ball.fixedUpdate(1 / 60);
  expect(beforeSlow - ball.position.x).toBeCloseTo(initialStep);
  ball.fallSpeed = 6000;
  const beforeExtreme = ball.position.x;
  ball.fixedUpdate(1 / 60);
  expect(beforeExtreme - ball.position.x).toBeCloseTo(initialStep * 3);
  simulate(ball, 1, 60);
  expect(ball.position.x).toBe(-47.5);
  ball.setPlayfieldHalfWidth(6); expect(ball.position.x).toBe(-5.5);
  ball.setPlayfieldHalfWidth(NaN); expect(ball.horizontalLimit).toBe(5.5);
  input.isActive = false; ball.fixedUpdate(1 / 60);
  expect(ball.horizontalVelocity).toBe(0);
});


it("keeps both weak and near-limit breaks moving while retaining a readable resistance difference", () => {
  const distance = (resistance: number): number => {
    const transform = createTransform();
    const ball = new BallController(transform, createInput(), gameConfig);
    ball.fallSpeed = 50;
    ball.startBreakImpact(0, resistance);
    if (resistance < .3) expect(ball.verticalVelocity).toBeLessThan(-10);
    simulate(ball, .05, 120);
    return -ball.position.y;
  };
  expect(distance(.2)).toBeGreaterThan(.65);
  expect(distance(.98)).toBeGreaterThan(.7);
  expect(distance(.2)).toBeGreaterThan(distance(.98));
});
