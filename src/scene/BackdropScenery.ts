import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import crystalDistantUrl from "../assets/worlds/neon-crystal-distant-atlas.webp";
import { CRYSTAL_DISTANT_ISLANDS } from "./CrystalSceneryLayout";
import { Vector4 } from "@babylonjs/core/Maths/math.vector";
import { Plane } from "@babylonjs/core/Maths/math.plane";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { Scene } from "@babylonjs/core/scene";
import { sceneryRate, sceneryY } from "./BackdropMotion";

const cards = import.meta.glob<string>("../assets/worlds/*-card-*.webp", { eager: true, query: "?url", import: "default" });
const bands = {
  sky: [[0, 480, 735, 1020, 1230, 1672], [0, 550, 810, 1110, 1330, 1672]],
  crystal: [[0, 390, 700, 1010, 1330, 1672], [0, 350, 700, 1010, 1320, 1672]],
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
    const name = location === "sky" ? "sky-islands" : "neon-crystal";
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
    if (location === "crystal") this.#addDistantIslands(scene, parent);
  }
  #addDistantIslands(scene: Scene, parent: Mesh): void {
    const texture = new Texture(crystalDistantUrl, scene, true, true, Texture.BILINEAR_SAMPLINGMODE);
    texture.hasAlpha = true; texture.wrapU = texture.wrapV = Texture.CLAMP_ADDRESSMODE;
    const material = new StandardMaterial("CrystalDistantIslandsMaterial", scene);
    material.diffuseTexture = texture; material.useAlphaFromDiffuseTexture = true;
    material.disableLighting = true; material.emissiveColor.copyFrom((parent.material as StandardMaterial).emissiveColor);
    material.specularColor = Color3.Black(); material.backFaceCulling = false;
    material.clipPlane = this.#top; material.clipPlane2 = this.#bottom;
    for (const [index, island] of CRYSTAL_DISTANT_ISLANDS.entries()) {
      const [left, top, right, bottom] = island.bounds;
      const x = ((left + right) / 2 / 941 - .5) * 28;
      const anchor = (.5 - (top + bottom) / 2 / 1672) * 42;
      for (const copy of [0, 1]) {
        const mesh = MeshBuilder.CreatePlane(`CrystalDistantIsland${String(index)}-${String(copy)}`, {
          width: 28 * 160 / 941, height: 42 * 192 / 1672,
          sideOrientation: Mesh.DOUBLESIDE,
          frontUVs: new Vector4(index / 7, 0, (index + 1) / 7, 1),
          backUVs: new Vector4(index / 7, 0, (index + 1) / 7, 1),
        }, scene);
        mesh.parent = parent; mesh.material = material; mesh.isPickable = false;
        mesh.position.set(x, 0, -.02);
        this.#cards.push({ mesh, material, x, edgeLimit: null, anchor, rate: island.rate, copy });
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
