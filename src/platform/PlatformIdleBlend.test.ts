import { expect, it } from "vitest";
import type { UniformBuffer } from "@babylonjs/core/Materials/uniformBuffer";
import type { Scene } from "@babylonjs/core/scene";
import type { AbstractEngine } from "@babylonjs/core/Engines/abstractEngine";
import type { SubMesh } from "@babylonjs/core/Meshes/subMesh";
import { PlatformIdleBlend } from "./PlatformIdleBlend";

it("wraps all four idle samples at the loop boundary and binds each mesh's state transition independently", () => {
  const values = new Map<string, number[]>();
  const buffer = {
    updateFloat4: (key: string, ...data: number[]) => values.set(key, data),
    updateFloat3: (key: string, ...data: number[]) => values.set(key, data),
  } as unknown as UniformBuffer;
  const bind = (metadata: object): void => {
    const subMesh = { getMesh: () => ({ metadata }) } as unknown as SubMesh;
    PlatformIdleBlend.prototype.hardBindForSubMesh(buffer, {} as Scene, {} as AbstractEngine, subMesh);
  };
  bind({ frame: 11, nextFrame: 0, blend: .5, idleFrames: 12, row: 2, previousRow: 0, rowBlend: .5 });
  expect(values.get("platformIdleMix")).toEqual([-1 / 12, -11 / 12, -10 / 12, .5]);
  expect(values.get("platformStateMix")).toEqual([.4, .5, 1]);
  bind({ frame: 0, nextFrame: 1, blend: 0, idleFrames: 12, row: 0 });
  expect(values.get("platformIdleMix")).toEqual([11 / 12, 1 / 12, 2 / 12, 0]);
  expect(values.get("platformStateMix")).toEqual([0, 1, 1]);
  bind({ frame: 11, nextFrame: 11, blend: 0, destroyFrames: 12, row: 3 });
  expect(values.get("platformStateMix")).toEqual([0, 1, 0]); // Destruction never loops into an intact frame.
});
