import { expect, it } from "vitest";
import { describeFailedImpact } from "./FailedImpact";
it("explains the actual collision speed, gap and whether one boost would suffice", () => {
  expect(describeFailedImpact(10, 14, 1.5)).toContain("Не хватило 4.00");
  expect(describeFailedImpact(10, 14, 1.5)).toContain("достаточно для пробития");
  expect(describeFailedImpact(10, 30, 1.5)).toContain("всё ещё мало");
  expect(describeFailedImpact(13.99, 14, 1.5)).toContain("Не хватило 0.01");
});
