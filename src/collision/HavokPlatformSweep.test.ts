import { PlatformRoutePlanner } from "../platform/PlatformRoutePlanner";
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
import { PlatformPool } from "../platform/PlatformPool";
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
    const sweepPlatforms = [platform];
    const sweep = new HavokPlatformSweep(
      scene,
      plugin,
      gameConfig.ball.radius,
      sweepPlatforms,
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

    const pool = new PlatformPool([platform]);
    expect(pool.beginRelease(platform)).toBe(true);
    expect(pool.availableCount).toBe(0);
    expect(sweep.cast({ x: 0, y: -5, z: 0 }, { x: 0, y: -11, z: 0 })).toBeNull();
    const destroyMaterial = sprite.material;
    const allocated = { textures: scene.textures.length, materials: scene.materials.length };
    for (let frame = 0; frame < 12; frame++) {
      platform.renderBreak(frame / 11);
      expect(sprite.metadata).toMatchObject({ spriteAtlas: "neon-destroy", frame, destroyFrames: 12 });
      expect(pool.availableCount).toBe(0);
    }
    expect(sprite.visibility).toBe(0);
    expect(pool.completeRelease(platform)).toBe(true);
    expect(pool.completeRelease(platform)).toBe(false);
    expect(pool.acquire()).toBe(platform);
    expect(sprite.visibility).toBe(1);
    expect(sprite.material).not.toBe(destroyMaterial);
    expect(sprite.metadata).toMatchObject({ spriteAtlas: "neon-rocks", idleFrames: 12 });
    expect({ textures: scene.textures.length, materials: scene.materials.length }).toEqual(allocated);

    const sidePlatform = new PlatformController(scene, gameConfig, { ...platformConfig, id: "late-side-platform", position: { x: 22, y: 0 } });
    sweepPlatforms.push(sidePlatform);
    expect(sweep.cast({ x: 22, y: 4, z: 0 }, { x: 22, y: -2, z: 0 })?.id).toBe("late-side-platform");
    sidePlatform.dispose();
    sweep.dispose();
    platform.dispose();
    scene.dispose();
    engine.dispose();
  });
});


it("lets a ball-sized Havok sweep fly through generated openings and hit the actual islands", async () => {
  const engine = new NullEngine();
  const scene = new Scene(engine);
  const wasm = await readFile(new URL("../../node_modules/@babylonjs/havok/lib/esm/HavokPhysics.wasm", import.meta.url));
  const plugin = new HavokPlugin(true, await HavokPhysics({ wasmBinary: Uint8Array.from(wasm).buffer }));
  scene.enablePhysics(Vector3.Zero(), plugin);
  const planner = new PlatformRoutePlanner(0, gameConfig, () => .2);
  const template = gameConfig.platforms[0];
  if (!template) throw new Error("Expected a platform template.");
  for (const theme of ["trap", "rich-lane", "death-tunnel"] as const) {
    planner.queueEncounter(theme);
    const plan = planner.planNext(50, 0, { stageNumber: 3, platformStrength: 12, reactionWindowSeconds: .8 });
    const members = [{ ...plan, yOffset: 0 }, ...(plan.choices ?? [])];
    const platforms = members.map((member, index) => {
      const platform = new PlatformController(scene, gameConfig, { ...template, id: `opening-${String(index)}` }, false);
      platform.reactivate(new Vector3(member.x, plan.y + (member.yOffset ?? 0), 0), {
        strength: member.strength, strengthLevel: member.strengthLevel, widthScale: member.widthScale,
      });
      return platform;
    });
    const sweep = new HavokPlatformSweep(scene, plugin, gameConfig.ball.radius, platforms);
    const passageX = plan.passage?.x ?? 0;
    expect(sweep.cast({ x: passageX, y: plan.y + 2, z: 0 }, { x: passageX, y: plan.y - (plan.bandDepth ?? 0) - 2, z: 0 })).toBeNull();
    expect(sweep.cast({ x: plan.x, y: plan.y + 2, z: 0 }, { x: plan.x, y: plan.y - 2, z: 0 })).not.toBeNull();
    sweep.dispose(); platforms.forEach(platform => { platform.dispose(); });
  }
  scene.dispose(); engine.dispose();
});

it("moves the real Havok collider with the platform group without recreating meshes or leaking motion on reuse", async () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  const wasm = await readFile(new URL("../../node_modules/@babylonjs/havok/lib/esm/HavokPhysics.wasm", import.meta.url));
  const plugin = new HavokPlugin(true, await HavokPhysics({ wasmBinary: Uint8Array.from(wasm).buffer }));
  scene.enablePhysics(Vector3.Zero(), plugin);
  const template = gameConfig.platforms[0]; if (!template) throw Error("Missing template");
  const platform = new PlatformController(scene, gameConfig, template, false);
  platform.reactivate(new Vector3(0, 0, 0), { strength: 10, strengthLevel: "low", widthScale: 1 / 7.5,
    lateralMotion: { amplitude: .35, period: 4, phase: 0 } });
  const sweep = new HavokPlatformSweep(scene, plugin, gameConfig.ball.radius, [platform]);
  const cast = (x: number) => sweep.cast({ x, y: 2, z: 0 }, { x, y: -2, z: 0 });
  expect(cast(-.9)?.id).toBe(platform.id); expect(cast(1.2)?.id).toBeUndefined();
  const counts = [scene.meshes.length, scene.materials.length, scene.textures.length];
  platform.advanceMotion(1);
  expect(platform.mesh.position.x).toBeCloseTo(.35);
  scene.getPhysicsEngine()?._step(1 / 60);
  expect(cast(-.9)?.id).toBeUndefined(); expect(cast(1.2)?.id).toBe(platform.id);
  for (let i = 0; i < 1000; i++) platform.advanceMotion(1 / 60);
  expect([scene.meshes.length, scene.materials.length, scene.textures.length]).toEqual(counts);
  platform.deactivate(); platform.reactivate(new Vector3(2, -2, 0), { strength: 10, strengthLevel: "low", widthScale: 1 / 7.5 });
  platform.advanceMotion(1); expect(platform.mesh.position.x).toBe(2); expect(platform.lateralMotion).toBeUndefined();
  sweep.dispose(); platform.dispose(); scene.dispose(); engine.dispose();
});

it("keeps cloud and bubble collision boxes and strength while replacing rock break art and resetting pooled skins",async()=>{
 const engine=new NullEngine(),scene=new Scene(engine);
 const wasmFile=await readFile(new URL("../../node_modules/@babylonjs/havok/lib/esm/HavokPhysics.wasm",import.meta.url));
 const instance=await HavokPhysics({wasmBinary:Uint8Array.from(wasmFile).buffer});
 const plugin=new HavokPlugin(true,instance);scene.enablePhysics(Vector3.Zero(),plugin);
 const template=gameConfig.platforms[0];if(!template)throw Error("Missing platform template");
 const platform=new PlatformController(scene,gameConfig,template),sweep=new HavokPlatformSweep(scene,plugin,.5,[platform]);
 for(const appearance of ["cloud","bubble"] as const){
  platform.deactivate();platform.reactivate(new Vector3(0,0,0),{appearance,strength:9,strengthLevel:"low",widthScale:.4});
  platform.setApproachFeedback(12,0);
  expect(platform.strength).toBe(9);expect(platform.width).toBe(3);
  expect(sweep.cast({x:0,y:3,z:0},{x:0,y:-3,z:0})?.id).toBe(platform.id);
  const rock=scene.getMeshByName(`${platform.id}-sprite`),body=scene.getMeshByName(`${platform.id}-sky-body`);
  expect(rock?.isVisible).toBe(false);expect(body?.isEnabled()).toBe(true);
  expect(platform.beginBreak()).toBe(true);platform.playImpact(1,.8);platform.renderBreak(.4);
  expect(rock?.isVisible).toBe(false);expect(body?.isEnabled()).toBe(true);
  expect(sweep.cast({x:0,y:3,z:0},{x:0,y:-3,z:0})).toBeNull();
  if(appearance==="bubble")expect(scene.getMeshByName(`${platform.id}-water-splash`)?.isEnabled()).toBe(true);
  platform.finishBreak();
 }
 platform.reactivate(new Vector3(0,0,0),{strength:9,strengthLevel:"low"});
 expect(platform.appearance).toBeUndefined();expect(scene.getMeshByName(`${platform.id}-sky-body`)?.isEnabled()).toBe(false);
 expect(scene.getMeshByName(`${platform.id}-sprite`)?.isVisible).toBe(true);
 platform.dispose();scene.dispose();engine.dispose();
});
