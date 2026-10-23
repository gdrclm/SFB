import { Constants } from "@babylonjs/core/Engines/constants";
import { ShaderMaterial } from "@babylonjs/core/Materials/shaderMaterial";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { setToonBallCrystalBlend } from "./ToonBallMaterial";

/** One soft additive quad behind the body; no full-screen bloom or extra textures. */
export class BallCrystalGlow {
  readonly #body: StandardMaterial;
  readonly #details: StandardMaterial | null;
  readonly #halo: Mesh;
  readonly #haloMaterial: ShaderMaterial;
  #blend = -1;

  public constructor(ball: Mesh, radius: number) {
    if (!(ball.material instanceof StandardMaterial)) throw new TypeError("Expected ball material.");
    this.#body = ball.material;
    const details = ball.getChildMeshes().find(mesh => mesh.name === "BallCapButton")?.material;
    this.#details = details instanceof StandardMaterial ? details : null;
    this.#halo = MeshBuilder.CreatePlane("BallCrystalHalo", { size: radius * 3.6 }, ball.getScene());
    this.#halo.parent = ball;
    this.#halo.position.z = radius * .8;
    this.#halo.billboardMode = Mesh.BILLBOARDMODE_ALL;
    this.#halo.isPickable = false;
    this.#haloMaterial = new ShaderMaterial("BallCrystalHaloMaterial", ball.getScene(), {
      vertexSource: `precision highp float;
        attribute vec3 position; attribute vec2 uv; uniform mat4 worldViewProjection;
        varying vec2 haloUV;
        void main(){ haloUV=uv; gl_Position=worldViewProjection*vec4(position,1.0); }`,
      fragmentSource: `precision highp float;
        varying vec2 haloUV; uniform float glowBlend;
        void main(){
          vec2 p=(haloUV-0.5)*2.0;
          float fade=pow(max(0.0,1.0-dot(p,p)),2.5);
          gl_FragColor=vec4(mix(vec3(0.30,0.12,1.0),vec3(0.02,0.85,1.0),haloUV.x),fade*0.65*glowBlend);
        }`,
    }, { attributes: ["position", "uv"], uniforms: ["worldViewProjection", "glowBlend"], needAlphaBlending: true });
    this.#haloMaterial.alphaMode = Constants.ALPHA_ADD;
    this.#haloMaterial.disableDepthWrite = true;
    this.#haloMaterial.backFaceCulling = false;
    this.#halo.material = this.#haloMaterial;
    this.setBlend(0);
  }

  public setBlend(value: number): void {
    const blend = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
    if (blend === this.#blend) return;
    this.#blend = blend;
    setToonBallCrystalBlend(this.#body, blend);
    this.#haloMaterial.setFloat("glowBlend", blend);
    this.#halo.visibility = blend;
    this.#halo.setEnabled(blend > 0);
    // Cap and limbs share the blue detail material. Face materials remain dark.
    this.#details?.emissiveColor.set(.01 + blend * .04, .18 + blend * .62, .38 + blend * .62);
  }

  public dispose(): void {
    this.setBlend(0);
    this.#halo.dispose();
    this.#haloMaterial.dispose();
  }
}
