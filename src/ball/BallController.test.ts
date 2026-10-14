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
    expect(transform.position.y).toBeGreaterThan(contactY);

    simulate(
      controller,
      gameConfig.unsuccessfulHit.bounceDurationSeconds - 1 / 60,
      60,
    );
    expect(controller.isBouncing).toBe(false);
    expect(controller.fallSpeed).toBe(gameConfig.ball.startFallSpeed);

    const bounceTop = transform.position.y;
    controller.fixedUpdate(1 / 60);
    expect(transform.position.y).toBeLessThan(bounceTop);
  });
});
