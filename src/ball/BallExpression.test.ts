import { expect, it } from "vitest";
import { BallExpressionState } from "./BallExpression";

it("keeps a real collision readable when coins and breaks arrive at the same moment", () => {
  const face = new BallExpressionState();
  face.react("boost");
  expect(face.react("coin")).toBe(false);
  expect(face.react("break")).toBe(false);
  expect(face.current).toBe("boost");
  face.react("hurt");
  expect(face.current).toBe("hurt");
  face.update(.3, false);
  expect(face.react("coin")).toBe(false);
  face.update(.4, true);
  expect(face.current).toBe("focus");
  face.update(.1, false);
  expect(face.current).toBe("neutral");
});

it("holds defeat until a new run and returns temporary reactions to normal", () => {
  const face = new BallExpressionState();
  face.react("heal"); face.update(.8, false);
  expect(face.current).toBe("neutral");
  face.react("defeat"); face.update(100, false);
  expect(face.current).toBe("defeat");
  expect(face.react("boost")).toBe(false);
  expect(new BallExpressionState().current).toBe("neutral");
});
