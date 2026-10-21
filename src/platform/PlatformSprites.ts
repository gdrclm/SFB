import atlasUrl from "../assets/platforms/neon-rocks.webp";
import idleAtlasUrl from "../assets/platforms/neon-idle-12.webp";
import { VertexBuffer } from "@babylonjs/core/Buffers/buffer";
import { IDLE_ATLAS_SIZE, idleSample, idlePhase, idleSpriteRect } from "./PlatformIdle";
import { PlatformIdleBlend } from "./PlatformIdleBlend";
import { PlatformCrystalSkin } from "./PlatformCrystalSkin";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Material } from "@babylonjs/core/Materials/material";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import type { Scene } from "@babylonjs/core/scene";
import { PLATFORM_ATLAS_SIZE, platformSpriteRect, platformSpriteSlices, type PlatformSpriteRow, type SpriteRect } from "./PlatformSpriteLayout";

const materials = new WeakMap<Scene, StandardMaterial>();
const idleMaterials = new WeakMap<Scene, StandardMaterial>();
function atlasMaterial(scene: Scene, idle = false): StandardMaterial {
  const cache = idle ? idleMaterials : materials;
  const prefix = idle ? "PlatformIdleAtlas" : "PlatformSpriteAtlas";
  const cached = cache.get(scene);
  if (cached !== undefined) return cached;
  const material = new StandardMaterial(`${prefix}Material`, scene);
  material.disableLighting = true;
  material.emissiveColor = Color3.White();
  material.specularColor = Color3.Black();
  material.backFaceCulling = false;
  material.useAlphaFromDiffuseTexture = true;
  // Idle frames include soft sparks, smoke and rings. Alpha testing cuts off
  // their faint edges, especially against the bright first location.
  material.transparencyMode = idle ? Material.MATERIAL_ALPHABLEND : Material.MATERIAL_ALPHATESTANDBLEND;
  material.alphaCutOff = .025;
  const texture = new Texture(idle ? idleAtlasUrl : atlasUrl, scene, true, true, Texture.BILINEAR_SAMPLINGMODE);
  texture.name = `${prefix}Texture`;
  texture.hasAlpha = true;
  texture.wrapU = texture.wrapV = Texture.CLAMP_ADDRESSMODE;
  material.diffuseTexture = texture;
  if (idle) new PlatformIdleBlend(material);
  new PlatformCrystalSkin(material);
  cache.set(scene, material);
  material.onDisposeObservable.addOnce(() => { cache.delete(scene); });
  return material;
}

/** One GPU atlas/material per scene, UVs per mesh; no canvas uploads during animation. */
export function createAtlasSprite(name: string, scene: Scene, idle = false): Mesh {
  const mesh = new Mesh(name, scene);
  mesh.material = atlasMaterial(scene, idle);
  mesh.isPickable = false;
  mesh.metadata = { spriteAtlas: "neon-rocks" };
  return mesh;
}

/** Begin falling only after the collision surfaces have visible artwork. */
export async function waitForPlatformSprites(scene: Scene): Promise<void> {
  await Promise.all([waitForAtlas(atlasMaterial(scene)), waitForAtlas(atlasMaterial(scene, true))]);
}

async function waitForAtlas(material: StandardMaterial): Promise<void> {
  const texture = material.diffuseTexture;
  const message = "Не удалось загрузить платформы. Попробуйте запустить забег ещё раз.";
  if (!(texture instanceof Texture) || texture.loadingError) throw new Error(message);
  if (texture.isReady()) return;
  await new Promise<void>((resolve, reject) => {
    const internal = texture.getInternalTexture();
    const finish = (error = false): void => {
      texture.onLoadObservable.remove(loaded);
      texture.onDisposeObservable.remove(disposed);
      internal?.onErrorObservable.remove(failed ?? null);
      if (error) reject(new Error(message)); else resolve();
    };
    const loaded = texture.onLoadObservable.addOnce(() => { finish(); });
    const failed = internal?.onErrorObservable.addOnce(() => { finish(true); });
    const disposed = texture.onDisposeObservable.addOnce(() => { finish(true); });
  });
}

export function setAtlasQuad(mesh: Mesh, rect: SpriteRect, width: number, height: number): void {
  applySlices(mesh, [{ left: -width / 2, right: width / 2, rect }], height / 2, -height / 2);
}

function applySlices(mesh: Mesh, slices: readonly { left: number; right: number; rect: SpriteRect }[], top: number, bottom: number, atlasSize = PLATFORM_ATLAS_SIZE, rebuild = true): void {
  const positions: number[] = [], uvs: number[] = [], indices: number[] = [], normals: number[] = [];
  for (const { left, right, rect } of slices) {
    const n = positions.length / 3;
    positions.push(left, bottom, 0, right, bottom, 0, right, top, 0, left, top, 0);
    const u0 = rect.x / atlasSize.width, u1 = (rect.x + rect.width) / atlasSize.width;
    const v0 = 1 - (rect.y + rect.height) / atlasSize.height, v1 = 1 - rect.y / atlasSize.height;
    uvs.push(u0, v0, u1, v0, u1, v1, u0, v1);
    indices.push(n, n + 2, n + 1, n, n + 3, n + 2);
    for (let i = 0; i < 4; i++) normals.push(0, 0, -1);
  }
  if (!rebuild) {
    mesh.updateVerticesData(VertexBuffer.UVKind, uvs);
    return;
  }
  const data = new VertexData();
  data.positions = positions; data.uvs = uvs; data.indices = indices; data.normals = normals;
  data.applyToMesh(mesh, true);
}

export class PlatformSprite {
  readonly mesh: Mesh;
  readonly #parent: Mesh;
  readonly #height: number;
  readonly #phase: number;
  #row: PlatformSpriteRow = 0;
  #frame = -1;
  #width = 0;
  public constructor(parent: Mesh, height: number, depth: number, scene: Scene) {
    this.#parent = parent; this.#height = height; this.#phase = idlePhase(parent.name);
    this.mesh = createAtlasSprite(`${parent.name}-sprite`, scene, true);
    this.mesh.parent = parent;
    this.mesh.position.z = -depth / 2 - .025;
  }
  public render(width: number, row: PlatformSpriteRow, elapsed: number): void {
    const { frame, nextFrame, blend } = idleSample(elapsed, this.#phase);
    if (frame === this.#frame && row === this.#row && width === this.#width) {
      (this.mesh.metadata as { blend: number }).blend = blend;
      return;
    }
    const rebuild = width !== this.#width || this.#frame < 0;
    this.#frame = frame; this.#row = row; this.#width = width;
    this.mesh.scaling.x = 1 / Math.max(.01, this.#parent.scaling.x);
    const rect = idleSpriteRect(row, frame);
    // The bright top rim coincides with the top of the unchanged collision box.
    const top = this.#height / 2 + .94;
    applySlices(this.mesh, platformSpriteSlices(width + .6, rect), top, top - 2.4, IDLE_ATLAS_SIZE, rebuild);
    this.mesh.metadata = { spriteAtlas: "neon-rocks", row, frame, nextFrame, blend, idleFrames: 12 };
  }
}

export function platformPreviewMarkup(row: PlatformSpriteRow, label: string): string {
  const rect = platformSpriteRect(row, 0);
  return `<svg class="tutorial-platform" viewBox="0 0 ${String(rect.width)} ${String(rect.height)}" role="img" aria-label="${label}"><svg width="${String(rect.width)}" height="${String(rect.height)}" viewBox="${String(rect.x)} ${String(rect.y)} ${String(rect.width)} ${String(rect.height)}"><image href="${atlasUrl}" width="1484" height="1060"/></svg></svg>`;
}
