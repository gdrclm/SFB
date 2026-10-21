import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import crystalObjectUrl from "../assets/worlds/neon-crystal-object-atlas.webp";
import crystalCloudUrl from "../assets/worlds/neon-crystal-clouds.webp";
import { CRYSTAL_ATLAS_SIZE, CRYSTAL_SCENERY } from "./CrystalSceneryLayout";
import { Vector4 } from "@babylonjs/core/Maths/math.vector";
import { Plane } from "@babylonjs/core/Maths/math.plane";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { Scene } from "@babylonjs/core/scene";
import { sceneryRate, sceneryY } from "./BackdropMotion";

const cards = import.meta.glob<string>("../assets/worlds/sky-islands-card-*.webp", { eager: true, query: "?url", import: "default" });
const bands = {
  sky: [[0, 480, 735, 1020, 1230, 1672], [0, 550, 810, 1110, 1330, 1672]],
} as const;
interface Card { mesh: Mesh; anchor: number; x: number; edgeLimit: number | null; rate: number; copy: number; material: StandardMaterial }
/** Baked scenery cards: no runtime canvas, image readback or texture uploads. */
export class BackdropScenery {
  readonly #cards: Card[] = [];
  readonly #top = new Plane(0, 1, 0, 0);
  readonly #bottom = new Plane(0, -1, 0, 0);
  readonly #parent: Mesh;
  public constructor(scene: Scene, parent: Mesh, location: "sky" | "crystal") {
    this.#parent = parent;
    if (location === "crystal") { this.#addCrystal(scene, parent); return; }
    const name = "sky-islands";
    for (const [side, edges] of bands[location].entries()) for (let i = 0; i < 5; i++) {
      const start = Math.max(0, (edges[i] ?? 0) - 34), end = Math.min(1672, (edges[i + 1] ?? 1672) + 34);
      const material = new StandardMaterial(`${name}Scenery${String(side)}-${String(i)}`, scene);
      const url = cards[`../assets/worlds/${name}-card-${String(side)}-${String(i)}.webp`];
      if (url === undefined) throw new Error("Missing backdrop scenery card");
      const texture = new Texture(url, scene, true, true, Texture.BILINEAR_SAMPLINGMODE);
      texture.hasAlpha = true; texture.wrapU = texture.wrapV = Texture.CLAMP_ADDRESSMODE;
      material.diffuseTexture = texture; material.useAlphaFromDiffuseTexture = true;
      material.disableLighting = true; material.emissiveColor.copyFrom((parent.material as StandardMaterial).emissiveColor);
      material.specularColor = Color3.Black(); material.backFaceCulling = false;
      material.clipPlane = this.#top; material.clipPlane2 = this.#bottom;
      const rate = sceneryRate(side * 5 + i);
      // Distant silhouettes recede; foreground cards have larger apparent size.
      const apparentSize = 1.08 + Math.min(1, rate) * .22;
      // A second copy makes wrap continuous even when a card straddles the page edge.
      for (const copy of [0, 1]) {
        const mesh = MeshBuilder.CreatePlane(`${name}Scenery${String(side)}-${String(i)}-${String(copy)}`, { width: 28 * 410 / 941, height: 42 * (end - start) / 1672 }, scene);
        mesh.scaling.setAll(apparentSize);
        mesh.parent = parent; mesh.material = material; mesh.isPickable = false;
        mesh.position.set((side === 0 ? -1 : 1) * (14 - 14 * 410 / 941), 0, -.04 - rate * .12);
        this.#cards.push({ mesh, material, x: mesh.position.x, edgeLimit: 14.2 - 14 * 410 / 941 * apparentSize, anchor: 21 - 42 * (start + end) / 2 / 1672, rate, copy });
      }
    }
  }
  #crystalMaterial(scene: Scene, parent: Mesh, name: string, url: string): StandardMaterial {
    const texture = new Texture(url, scene, true, true, Texture.BILINEAR_SAMPLINGMODE);
    texture.hasAlpha = true; texture.wrapU = texture.wrapV = Texture.CLAMP_ADDRESSMODE;
    const material = new StandardMaterial(name, scene);
    material.diffuseTexture = texture; material.useAlphaFromDiffuseTexture = true;
    material.disableLighting = true; material.emissiveColor.copyFrom((parent.material as StandardMaterial).emissiveColor);
    material.specularColor = Color3.Black(); material.backFaceCulling = false;
    material.clipPlane = this.#top; material.clipPlane2 = this.#bottom;
    return material;
  }
  #addCrystal(scene: Scene, parent: Mesh): void {
    const cloudMaterial = this.#crystalMaterial(scene, parent, "CrystalCloudsMaterial", crystalCloudUrl);
    for (const side of [0, 1]) {
      const x = side === 0 ? -7 : 7;
      const uv = new Vector4(side / 2, 0, (side + 1) / 2, 1);
      for (const copy of [0, 1]) {
        const mesh = MeshBuilder.CreatePlane(`CrystalCloud${String(side)}-${String(copy)}`, {
          width: 14, height: 42, sideOrientation: Mesh.DOUBLESIDE, frontUVs: uv, backUVs: uv,
        }, scene);
        mesh.parent = parent; mesh.material = cloudMaterial; mesh.isPickable = false;
        mesh.alphaIndex = -300;
        mesh.position.set(x, 0, -.015);
        this.#cards.push({ mesh, material: cloudMaterial, x, edgeLimit: 7, anchor: 0, rate: side === 0 ? .08 : .13, copy });
      }
    }
    const material = this.#crystalMaterial(scene, parent, "CrystalWholeIslandsMaterial", crystalObjectUrl);
    const [atlasWidth, atlasHeight] = CRYSTAL_ATLAS_SIZE;
    for (const island of CRYSTAL_SCENERY) {
      const [left, top, right, bottom] = island.bounds;
      const [u, v, pixelWidth, pixelHeight] = island.atlas;
      const x = ((left + right) / 2 / 941 - .5) * 28;
      const anchor = (.5 - (top + bottom) / 2 / 1672) * 42;
      // Babylon's plane UVs start at the bottom, while the atlas manifest starts at the top.
      const uv = new Vector4(u / atlasWidth, 1 - (v + pixelHeight) / atlasHeight,
        (u + pixelWidth) / atlasWidth, 1 - v / atlasHeight);
      const width = 28 * pixelWidth / 941;
      for (const copy of [0, 1]) {
        const mesh = MeshBuilder.CreatePlane(`CrystalIsland-${island.name}-${String(copy)}`, {
          width, height: 42 * pixelHeight / 1672,
          sideOrientation: Mesh.DOUBLESIDE, frontUVs: uv, backUVs: uv,
        }, scene);
        mesh.parent = parent; mesh.material = material; mesh.isPickable = false;
        mesh.position.set(x, 0, -.04 - island.rate * .12);
        // Sort by scenery depth, not by distance from each quad's centre.
        // Negative indices keep every background layer below gameplay sprites.
        mesh.alphaIndex = -200 + Math.round(island.rate * 100);
        this.#cards.push({ mesh, material, x, edgeLimit: island.edge === null ? null : 14 - width / 2,
          anchor, rate: island.rate, copy });
      }
    }
  }
  public isReady(): boolean { return this.#cards.every(card => card.material.diffuseTexture?.isReady() === true); }
  public update(cameraTravel: number, cameraX: number, worldCenterY: number, height: number, reduced: boolean): void {
    this.#top.d = -(worldCenterY + height / 2);
    this.#bottom.d = worldCenterY - height / 2;
    for (const card of this.#cards) {
      const y = sceneryY(card.anchor, reduced ? cameraTravel * .2 : cameraTravel, card.rate);
      card.mesh.position.y = y + (card.copy === 0 ? 0 : y > 0 ? -42 : 42);
      const lateral = reduced ? 0 : cameraX * card.rate * .45 / this.#parent.scaling.x;
      // Keep large foreground silhouettes outside the central play corridor.
      const x = card.x - Math.max(-1.8, Math.min(1.8, lateral));
      // Source art is cropped at the outer screen edge: keep that edge offscreen.
      card.mesh.position.x = card.edgeLimit === null ? x
        : card.x < 0 ? Math.min(-card.edgeLimit, x) : Math.max(card.edgeLimit, x);
    }
  }
}
