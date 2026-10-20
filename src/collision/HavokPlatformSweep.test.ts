import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { HavokPlugin } from "@babylonjs/core/Physics";
import { Scene } from "@babylonjs/core/scene";
import HavokPhysics from "@babylonjs/havok";
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { gameConfig } from "../config/gameConfig";
import { PlatformController } from "../platform/PlatformController";
import { HavokPlatformSweep } from "./HavokPlatformSweep";

describe("HavokPlatformSweep", () => {
  it("detects a static platform crossed in one high-speed step", async () => {
    const engine = new NullEngine();
    const scene = new Scene(engine);
    const wasmFile = await readFile(
      new URL("../../node_modules/@babylonjs/havok/lib/esm/HavokPhysics.wasm", import.meta.url),
    );
    const wasmBinary = Uint8Array.from(wasmFile).buffer;
    const havokInstance = await HavokPhysics({ wasmBinary });
    const plugin = new HavokPlugin(true, havokInstance);
    scene.enablePhysics(Vector3.Zero(), plugin);

    const [platformConfig] = gameConfig.platforms;
    if (platformConfig === undefined) {
      throw new Error("The test requires at least one configured platform.");
    }
    const platform = new PlatformController(scene, gameConfig, platformConfig);
    const defaultOutline = platform.mesh.outlineWidth;
    platform.setApproachFeedback(10, 0);
    expect(platform.approachState).toBe("breakable");
    expect(platform.mesh.outlineWidth).toBeGreaterThan(defaultOutline);
    platform.setApproachFeedback(6.5, 0.5);
    expect(platform.approachState).toBe("close");
    platform.setApproachFeedback(2, 0.5);
    expect(platform.approachState).toBe("danger");
    expect(platform.mesh.outlineWidth).toBeGreaterThan(0.08);
    platform.setApproachFeedback(null);
    expect(platform.approachState).toBeNull();
    expect(platform.mesh.outlineWidth).toBe(defaultOutline);
    const standardVertexCount = platform.mesh.getTotalVertices();
    expect(platform.mesh.getTotalVertices()).toBeGreaterThan(24);
    expect(platform.mesh.getBoundingInfo().boundingBox.extendSize.x * 2)
      .toBeCloseTo(platformConfig.size.width, 5);
    expect(platform.mesh.getBoundingInfo().boundingBox.extendSize.y * 2)
      .toBeCloseTo(platformConfig.size.height, 5);
    const sweep = new HavokPlatformSweep(
      scene,
      plugin,
      gameConfig.ball.radius,
      [platform],
    );

    expect(
      sweep.cast(
        { x: 0, y: 4, z: gameConfig.playSpace.depth },
        { x: 0, y: -2, z: gameConfig.playSpace.depth },
      )?.id,
    ).toBe(platform.id);

    platform.deactivate();
    expect(
      sweep.cast(
        { x: 0, y: 4, z: gameConfig.playSpace.depth },
        { x: 0, y: -2, z: gameConfig.playSpace.depth },
      ),
    ).toBeNull();

    platform.reactivate(
      new Vector3(0, -5, gameConfig.playSpace.depth),
      {
        strength: 14,
        strengthLevel: "high",
        routeKind: "bypass",
        kind: "super-heavy",
        isTrap: true,
      },
    );
    expect(platform.strength).toBe(14);
    expect(platform.strengthLevel).toBe("high");
    expect(platform.routeKind).toBe("bypass");
    expect(platform.kind).toBe("super-heavy");
    expect(platform.mesh.getTotalVertices()).not.toBe(standardVertexCount);
    expect(platform.mesh.getBoundingInfo().boundingBox.extendSize.x * 2)
      .toBeCloseTo(platformConfig.size.width, 5);
    const metadata = platform.mesh.metadata as { readonly kind?: unknown } | null;
    expect(metadata?.kind).toBe("super-heavy");
    expect(
      sweep.cast(
        { x: 0, y: -3, z: gameConfig.playSpace.depth },
        { x: 0, y: -7, z: gameConfig.playSpace.depth },
      )?.id,
    ).toBe(platform.id);

    platform.deactivate();
    platform.reactivate(
      new Vector3(0, -8, gameConfig.playSpace.depth),
      {
        strength: 18,
        strengthLevel: "high",
        routeKind: "boost",
        kind: "standard",
        isTrap: true,
      },
    );
    const brightMaterial = platform.mesh.material;
    expect(brightMaterial).toBeInstanceOf(StandardMaterial);
    if (!(brightMaterial instanceof StandardMaterial)) {
      throw new Error("The platform requires a StandardMaterial.");
    }
    expect(brightMaterial.disableLighting).toBe(true);
    expect(brightMaterial.useEmissiveAsIllumination).toBe(true);
    expect(brightMaterial.diffuseColor.r).toBeGreaterThan(0.9);
    expect(brightMaterial.diffuseColor.g).toBeGreaterThan(0.6);
    expect(brightMaterial.emissiveColor.r).toBeGreaterThan(0.9);
    expect(platform.mesh.getTotalVertices()).toBe(standardVertexCount);

    sweep.dispose();
    platform.dispose();
    scene.dispose();
    engine.dispose();
  });
});
