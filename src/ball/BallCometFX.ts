import { Constants } from "@babylonjs/core/Engines/constants";
import { Effect } from "@babylonjs/core/Materials/effect";
import { ShaderMaterial } from "@babylonjs/core/Materials/shaderMaterial";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import type { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { Scene } from "@babylonjs/core/scene";

Effect.ShadersStore.ballCometVertexShader = `
precision highp float;
attribute vec3 position;
attribute vec2 uv;
uniform mat4 worldViewProjection;
varying vec2 vUV;
void main() { vUV = uv; gl_Position = worldViewProjection * vec4(position, 1.0); }
`;
Effect.ShadersStore.ballCometFragmentShader = `
precision highp float;
varying vec2 vUV;
uniform float power;
uniform float time;
uniform float strength;
uniform float stretch;
float glow(float x, float width) { return exp(-x*x/(width*width)); }
void main() {
  vec2 p = vec2((vUV.x-.5)*4.8, vUV.y*11.0-1.5);
  float crossSection = inversesqrt(stretch);
  float core = 0.0, cyan = 0.0, halo = 0.0;
  for (int i = 0; i < 5; i++) {
    float seed = float(i);
    float side = i == 0 ? -.86 : i == 1 ? .87 : i == 2 ? -.31 : i == 3 ? -1.15 : 1.17;
    float reach = i == 0 ? 7.4 : i == 1 ? 8.9 : i == 2 ? 5.3 : i == 3 ? 3.9 : 4.6;
    reach *= .62 + power*.38;
    float y = p.y + .2*stretch;
    float t = clamp(y / reach, 0.0, 1.0);
    float base = smoothstep(-.8*stretch, .15, y);
    float tip = 1.0-smoothstep(.65, 1.0, t);
    float width = .03 + .18*pow(1.0-t, 1.8);
    float bend = sin(y*1.1-time*3.0+seed)*.018*t;
    float dx = p.x-side*crossSection-bend;
    float flow = .88+.12*sin(y*15.0-time*24.0+seed*2.0);
    float weight = i < 2 ? 1.0 : i == 2 ? .6 : .35;
    core += glow(dx, width*.6)*base*tip*weight*flow;
    cyan += glow(dx, width*1.7)*base*pow(tip,.7)*weight;
    halo += glow(dx, width*5.5)*base*pow(tip,.5)*weight;
  }
  // Broad blue aura at the origin connects the spikes to the silhouette.
  vec2 a = vec2(p.x/(1.0*crossSection), (p.y-.25)/(1.2*stretch));
  float aura = exp(-dot(a,a)*1.5);
  halo += aura*.65;
  cyan += aura*.24;
  vec3 light = vec3(.015,.22,.9)*halo*.6 + vec3(.025,.78,1.0)*cyan*.8 + vec3(.88,.98,1.0)*core*1.8;
  // Fade the outer boundary of the quad, even during the strongest boost.
  float edge = smoothstep(0.0,.2,vUV.y)*(1.0-smoothstep(.9,1.0,vUV.y))
    *smoothstep(0.0,.18,vUV.x)*(1.0-smoothstep(.82,1.0,vUV.x));
  gl_FragColor = vec4(light*strength*edge, 1.0);
}
`;

/** A single additive mesh: five sharp white cores, cyan sheaths and a wide blue aura. */
export class BallCometFX {
  readonly #mesh: Mesh;
  readonly #material: ShaderMaterial;
  public constructor(scene: Scene, root: TransformNode, radius: number) {
    this.#mesh = MeshBuilder.CreatePlane("BallFXComet", { width: radius*4.8, height: radius*11, sideOrientation: Mesh.DOUBLESIDE }, scene);
    this.#mesh.parent = root;
    this.#mesh.position.set(0, radius*4, radius*.3);
    this.#mesh.isPickable = false;
    this.#mesh.visibility = 0;
    this.#material = new ShaderMaterial("BallFXCometMaterial", scene, "ballComet", {
      attributes: ["position", "uv"], uniforms: ["worldViewProjection", "time", "power", "strength", "stretch"], needAlphaBlending: true,
    });
    this.#material.alphaMode = Constants.ALPHA_ONEONE;
    this.#material.disableDepthWrite = true;
    this.#material.backFaceCulling = false;
    this.#mesh.material = this.#material;
  }
  public update(time: number, power: number, boost: number, stretch: number, suppressed: boolean): void {
    const amount = Math.max(Math.pow(power, .4), boost);
    this.#mesh.visibility = suppressed || amount < .01 ? 0 : 1;
    this.#material.setFloat("time", time);
    this.#material.setFloat("power", Math.min(1, power + boost*.3));
    this.#material.setFloat("strength", .9*amount + boost*.35);
    this.#material.setFloat("stretch", Math.max(.7, stretch));
  }
  public dispose(): void { this.#mesh.dispose(); this.#material.dispose(); }
}
