import { expect, it } from "vitest";
import { scannerDanger } from "./DangerScanner";
it("warns about dangerous surfaces within three metres, across lanes, without marking safe or passed platforms", () => {
  const ball = { position: { x: 0, y: 0 }, fallSpeed: 10 };
  const platform = { isActive: true, strength: 20, width: 2, mesh: { position: { x: 0, y: -4 } }, size: { height: 1 } };
  expect(scannerDanger(ball, platform, .5, 3)).toBe(true);
  platform.mesh.position.y = -4.01;
  expect(scannerDanger(ball, platform, .5, 3)).toBe(false);
  platform.mesh.position.y = -1; platform.mesh.position.x = 4.5;
  expect(scannerDanger(ball, platform, .5, 3)).toBe(true);
  platform.mesh.position.x = 4.51;
  expect(scannerDanger(ball, platform, .5, 3)).toBe(false);
  platform.mesh.position.x = 0; platform.strength = 10;
  expect(scannerDanger(ball, platform, .5, 3)).toBe(false);
  platform.strength = 20; platform.mesh.position.y = 1;
  expect(scannerDanger(ball, platform, .5, 3)).toBe(false);
  platform.mesh.position.y = -1;
  expect(scannerDanger(ball, platform, .5, 0)).toBe(false);
});
