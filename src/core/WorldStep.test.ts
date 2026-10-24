import { expect, it } from "vitest";
import { WorldStep } from "./WorldStep";
it("resolves movement and contacts before collecting rewards or recycling/generating anything", () => {
  const order: string[] = [];
  const tick = (name: string) => ({ fixedUpdate: () => { order.push(name); } });
  new WorldStep(tick("ball"), tick("contacts"), tick("coins"), tick("coin cleanup"), tick("platform cleanup/generation")).fixedUpdate(1 / 60);
  expect(order).toEqual(["ball", "contacts", "coins", "coin cleanup", "platform cleanup/generation"]);
});
it("cannot grant coins or generate scenery after a fatal impact", () => {
  const calls: string[] = [], tick = (name: string) => ({ fixedUpdate: () => { calls.push(name); } });
  new WorldStep(tick("ball"), tick("fatal contact"), tick("coins"), tick("cleanup"), tick("platforms"), () => false).fixedUpdate(1 / 60);
  expect(calls).toEqual(["ball", "fatal contact"]);
});
