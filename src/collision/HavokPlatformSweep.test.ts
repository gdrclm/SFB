import { VertexBuffer } from "@babylonjs/core/Buffers/buffer";
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
    const sprite = platform.mesh.getChildMeshes()[0];
    if (sprite === undefined) throw new Error("The platform requires an atlas sprite");
    expect(platform.mesh.isVisible).toBe(false);
    expect(sprite.isVisible).toBe(true);
    platform.setApproachFeedback(10, 0);
    expect(platform.approachState).toBe("breakable");
    expect(sprite.metadata).toMatchObject({ spriteAtlas: "neon-rocks", row: 0 });
    platform.setApproachFeedback(6.5, 0.5);
    expect(platform.approachState).toBe("boost");
    platform.setApproachFeedback(2, 0.5, true, 1.5, .5);
    expect(platform.approachState).toBe("danger");
    expect(sprite.metadata).toMatchObject({ row: 2 });
    platform.setApproachFeedback(null);
    expect(platform.approachState).toBeNull();
    expect(sprite.metadata).toMatchObject({ row: 0 });
    const positions = Array.from(sprite.getVerticesData(VertexBuffer.PositionKind) ?? []);
    const positionBuffer = sprite.getVertexBuffer(VertexBuffer.PositionKind);
    const uvBuffer = sprite.getVertexBuffer(VertexBuffer.UVKind);
    const poses = new Set<number>();
    for (let frame = 1; frame <= 12; frame++) {
      platform.setApproachFeedback(null, frame / 12);
      poses.add((sprite.metadata as { frame: number }).frame);
      expect(Array.from(sprite.getVerticesData(VertexBuffer.PositionKind) ?? [])).toEqual(positions);
      expect(sprite.getVertexBuffer(VertexBuffer.PositionKind)).toBe(positionBuffer);
      expect(sprite.getVertexBuffer(VertexBuffer.UVKind)).toBe(uvBuffer);
    }
    expect(poses.size).toBe(12);
    platform.setApproachFeedback(null, .42);
    const pausedUVs = Array.from(sprite.getVerticesData(VertexBuffer.UVKind) ?? []);
    const startBlend = (sprite.metadata as { blend: number }).blend;
    platform.setApproachFeedback(null, .421);
    expect((sprite.metadata as { blend: number }).blend).toBeGreaterThan(startBlend);
    expect(Array.from(sprite.getVerticesData(VertexBuffer.UVKind) ?? [])).toEqual(pausedUVs);
    expect(Array.from(sprite.getVerticesData(VertexBuffer.PositionKind) ?? [])).toEqual(positions);
    platform.setApproachFeedback(null, .42);
    for (let i = 0; i < 20; i++) platform.setApproachFeedback(null, .42);
    expect(Array.from(sprite.getVerticesData(VertexBuffer.UVKind) ?? [])).toEqual(pausedUVs);
    platform.setApproachFeedback(null, 0);
    expect(sprite.metadata).toMatchObject({ frame: 0, idleFrames: 12 });
    const standardVertexCount = platform.mesh.getTotalVertices();
    expect(platform.mesh.getTotalVertices()).toBe(24);
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
    expect(platform.mesh.getTotalVertices()).toBe(standardVertexCount);
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
    const brightMaterial = sprite.material;
    expect(brightMaterial).toBeInstanceOf(StandardMaterial);
    if (!(brightMaterial instanceof StandardMaterial)) {
      throw new Error("The platform requires a StandardMaterial.");
    }
    expect(brightMaterial.disableLighting).toBe(true);
    expect(brightMaterial.useAlphaFromDiffuseTexture).toBe(true);
    expect(brightMaterial.diffuseColor.r).toBeGreaterThan(0.9);
    expect(brightMaterial.diffuseColor.g).toBeGreaterThan(0.6);
    expect(brightMaterial.emissiveColor.r).toBeGreaterThan(0.9);
    expect(platform.mesh.getTotalVertices()).toBe(standardVertexCount);

    // A special skin and animation must keep the same collider and atlas resources.
    const textureCount = scene.textures.length;
    const materialCount = scene.materials.length;
    for (const kind of ["vitality", "time-slow", "standard"] as const) {
      platform.deactivate();
      platform.reactivate(new Vector3(0, -8, gameConfig.playSpace.depth), {
        strength: 7, strengthLevel: "low", kind, widthScale: .4,
      });
      for (let frame = 0; frame < 12; frame++) platform.setApproachFeedback(null, frame / 5);
      expect(platform.width).toBeCloseTo(3);
      expect(sweep.cast({ x: 0, y: -5, z: 0 }, { x: 0, y: -11, z: 0 })?.id).toBe(platform.id);
      expect(sweep.cast({ x: 3, y: -5, z: 0 }, { x: 3, y: -11, z: 0 })).toBeNull();
      expect(scene.textures.length).toBe(textureCount);
      expect(scene.materials.length).toBe(materialCount);
    }

    sweep.dispose();
    platform.dispose();
    scene.dispose();
    engine.dispose();
  });
});
