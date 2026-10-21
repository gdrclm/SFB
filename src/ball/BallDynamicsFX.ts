import { Constants } from "@babylonjs/core/Engines/constants";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Material } from "@babylonjs/core/Materials/material";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { Scene } from "@babylonjs/core/scene";
import type { BallExpression } from "./BallExpression";
import { BallCometFX } from "./BallCometFX";
import { speedVisualPower } from "./BallSpeedVisuals";

interface Particle {
  mesh: Mesh; offset: Vector3; velocity: Vector3; age: number; life: number; follow: boolean; scale: number;
}
export interface BallFXMotion {
  speed: number; look: number; boost: number; anticipating: boolean; slow: boolean; danger: boolean;
}
const clamp = (value: number): number => Math.max(0, Math.min(1, value));

/** Additive ribbons with a soft cross-section: genuine geometry, no billboard atlas. */
function ribbon(name: string, path: readonly Vector3[], width: number, scene: Scene, tapered = false): Mesh {
  const mesh = new Mesh(name, scene), positions: number[] = [], colors: number[] = [], indices: number[] = [];
  path.forEach((point, i) => {
    const previous = path[Math.max(0, i - 1)] ?? point, next = path[Math.min(path.length - 1, i + 1)] ?? point;
    const tangent = next.subtract(previous), length = Math.max(.001, Math.hypot(tangent.x, tangent.y));
    const nx = -tangent.y / length, ny = tangent.x / length, t = i / (path.length - 1);
    const fade = Math.sin(t * Math.PI) ** .7;
    const localWidth = width * (tapered ? .12 + .88 * (1 - t) ** .8 : 1);
    for (const [offset, alpha] of [[-2.8, 0], [-.35, 1], [.35, 1], [2.8, 0]]) {
      positions.push(point.x + nx * localWidth * (offset ?? 0), point.y + ny * localWidth * (offset ?? 0), point.z);
      colors.push(1, 1, 1, fade * (alpha ?? 0));
    }
    if (i > 0) for (let j = 0; j < 3; j++) {
      const n = i * 4 + j; indices.push(n - 4, n, n + 1, n - 4, n + 1, n - 3);
    }
  });
  const data = new VertexData(); data.positions = positions; data.indices = indices; data.colors = colors;
  const normals: number[] = []; VertexData.ComputeNormals(positions, indices, normals); data.normals = normals;
  data.applyToMesh(mesh); mesh.hasVertexAlpha = true; mesh.isPickable = false;
  return mesh;
}

function star(name: string, scene: Scene): Mesh {
  const mesh = new Mesh(name, scene), p = [0, 0, -.08, 0, 0, .08], indices: number[] = [];
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4, radius = i % 2 === 0 ? 1 : .23;
    p.push(Math.cos(a) * radius, Math.sin(a) * radius, 0);
  }
  for (let i = 0; i < 8; i++) { const a = 2 + i, b = 2 + (i + 1) % 8; indices.push(0, b, a, 1, a, b); }
  const normals: number[] = []; VertexData.ComputeNormals(p, indices, normals);
  const data = new VertexData(); data.positions = p; data.normals = normals; data.indices = indices; data.applyToMesh(mesh);
  mesh.isPickable = false; return mesh;
}

export class BallDynamicsFX {
  readonly #ball: Mesh;
  readonly #radius: number;
  readonly #root: TransformNode;
  readonly #comet: BallCometFX;
  readonly #materials: StandardMaterial[] = [];
  readonly #arcs: Mesh[] = [];
  readonly #wind: Mesh[] = [];
  readonly #dots: Mesh[] = [];
  readonly #drops: Mesh[] = [];
  readonly #stars: Particle[] = [];
  readonly #shards: Particle[] = [];
  readonly #flash: Mesh;
  readonly #reduced: boolean;
  readonly #baselineSpeed: number;
  #time = 0;
  #impactAge = 1;
  #hurtAge = 1;
  #coinAge = 1;
  #starCursor = 0;
  #shardCursor = 0;
  #arcAmount = 0;
  #windAmount = 0;

  public constructor(ball: Mesh, radius: number, reducedMotion = false, baselineSpeed = 10) {
    this.#ball = ball; this.#radius = radius; this.#reduced = reducedMotion;
    this.#baselineSpeed = baselineSpeed;
    const scene = ball.getScene();
    this.#root = new TransformNode("BallFXRoot", scene);
    this.#comet = new BallCometFX(scene, this.#root, radius);
    const material = (name: string, color: Color3, additive = true): StandardMaterial => {
      const m = new StandardMaterial(name, scene); m.disableLighting = true; m.diffuseColor = Color3.Black();
      m.emissiveColor = color; m.backFaceCulling = false; m.disableDepthWrite = true;
      m.transparencyMode = Material.MATERIAL_ALPHABLEND; m.alphaMode = additive ? Constants.ALPHA_ADD : Constants.ALPHA_COMBINE;
      this.#materials.push(m); return m;
    };
    const cyan = material("BallFXCyan", new Color3(.12, .8, 1));
    const blue = material("BallFXBlue", new Color3(.03, .28, 1));
    const white = material("BallFXWhite", new Color3(.85, .97, 1));
    const gold = material("BallFXGold", new Color3(1, .72, .12), false);
    const crystal = material("BallFXCrystal", new Color3(.08, .65, 1), false);
    crystal.disableLighting = false; crystal.diffuseColor.set(.04, .22, .45);
    crystal.emissiveColor.scaleInPlace(.28); crystal.specularColor.set(.3, .7, 1); crystal.specularPower = 24;
    for (let i = 0; i < 4; i++) {
      const path = Array.from({ length: 41 }, (_, j) => {
        const a = j / 40 * Math.PI * (i >= 2 ? 1.9 : 1.3);
        return new Vector3(Math.cos(a) * radius * (1.3 + i * .12), Math.sin(a) * radius * (1.15 + i * .1), Math.sin(a) * radius * .42);
      });
      const arc = ribbon(`BallFXArc-${String(i)}`, path, radius * (i % 2 ? .025 : .055), scene);
      arc.parent = this.#root; arc.material = i % 2 ? blue : cyan; arc.visibility = 0; this.#arcs.push(arc);
    }
    for (let i = 0; i < 15; i++) {
      const path = Array.from({ length: 13 }, (_, j) => {
        const t = j / 12;
        return new Vector3(Math.sin(t * 2 + i) * radius * .14, radius * ((i < 3 ? .35 : -1.1) + t * (i < 3 ? 3.7 : 3.2)), radius * .15);
      });
      const wind = ribbon(`BallFXWind-${String(i)}`, path, radius * (i < 3 ? .18 : .03), scene, true);
      wind.parent = this.#root; wind.material = i === 1 ? cyan : i < 3 ? blue : i % 2 ? blue : white; wind.visibility = 0; this.#wind.push(wind);
      if (i < 8) {
        const dot = MeshBuilder.CreateSphere(`BallFXOrbitDot-${String(i)}`, { diameter: radius * .1, segments: 8 }, scene);
        dot.parent = this.#root; dot.material = i % 2 ? cyan : blue; dot.isPickable = false; dot.visibility = 0; this.#dots.push(dot);
      }
    }
    for (let i = 0; i < 4; i++) {
      const drop = MeshBuilder.CreateLathe(`BallFXSweat-${String(i)}`, {
        shape: [new Vector3(0, -.13, 0), new Vector3(.055, -.09, 0), new Vector3(.065, -.025, 0), new Vector3(.035, .06, 0), new Vector3(0, .16, 0)].map(v => v.scale(radius)), tessellation: 10,
      }, scene);
      drop.parent = this.#root; drop.material = cyan; drop.isPickable = false; drop.visibility = 0; this.#drops.push(drop);
    }
    for (let i = 0; i < 12; i++) {
      const spark = star(`BallFXStar-${String(i)}`, scene); spark.material = i % 3 === 0 ? white : gold; spark.visibility = 0;
      this.#stars.push({ mesh: spark, offset: Vector3.Zero(), velocity: Vector3.Zero(), age: 1, life: .5, follow: true, scale: radius * .16 });
      const shard = MeshBuilder.CreatePolyhedron(`BallFXShard-${String(i)}`, { type: 1, size: radius * .12 }, scene);
      shard.material = crystal; shard.isPickable = false; shard.visibility = 0;
      this.#shards.push({ mesh: shard, offset: Vector3.Zero(), velocity: Vector3.Zero(), age: 1, life: .5, follow: false, scale: 1 });
    }
    this.#flash = star("BallFXImpactFlash", scene); this.#flash.parent = this.#root;
    this.#flash.material = white; this.#flash.position.y = -radius * .9; this.#flash.visibility = 0;
  }

  public trigger(event: BallExpression): void {
    this.#root.position.copyFrom(this.#ball.position);
    if (event === "break" || event === "hurt") {
      this.#impactAge = 0;
      this.#flash.visibility = this.#reduced ? .25 : .8;
      this.#flash.scaling.set(this.#radius, this.#radius * .35, this.#radius);
    }
    if (event === "hurt" || event === "defeat") this.#hurtAge = 0;
    if (event === "break") this.#emit(this.#shards, this.#reduced ? 3 : 8, false, .45);
    if (event === "coin" && this.#coinAge >= .14) { this.#coinAge = 0; this.#emit(this.#stars, this.#reduced ? 2 : 5, true, .45); }
    if (event === "combo" || event === "heal") this.#emit(this.#stars, this.#reduced ? 3 : 8, true, .65);
    if (event === "hurt" || event === "defeat") this.#emit(this.#stars, this.#reduced ? 2 : 4, true, .7);
  }

  #emit(pool: Particle[], count: number, follow: boolean, life: number): void {
    for (let i = 0; i < count; i++) {
      const cursor = follow ? this.#starCursor++ : this.#shardCursor++;
      const particle = pool[cursor % pool.length]; if (!particle) continue;
      const angle = i / count * Math.PI * 2 + this.#time * .8, r = this.#radius;
      particle.age = 0; particle.life = life; particle.follow = follow;
      particle.offset.set(Math.cos(angle) * r * (follow ? 1.2 : .25), follow ? Math.sin(angle) * r * 1.2 : -r * .8, -.1 * r);
      if (!follow) particle.offset.addInPlace(this.#ball.position);
      const force = this.#reduced ? .25 : 1;
      particle.velocity.set(Math.cos(angle) * r * (follow ? 1.8 : 7) * force, (follow ? Math.sin(angle) * 1.8 : 2 + Math.sin(angle) * 4) * r * force, Math.sin(angle * 2) * r);
      particle.mesh.rotation.set(i * .7, i * .3, angle);
      particle.mesh.position.copyFrom(particle.offset);
      if (follow) particle.mesh.position.addInPlace(this.#ball.position);
      particle.mesh.scaling.setAll(particle.scale * (follow ? .5 : 1));
      particle.mesh.visibility = 1;
    }
  }

  public update(delta: number, motion: BallFXMotion): void {
    this.#time += delta; this.#impactAge += delta; this.#hurtAge += delta; this.#coinAge += delta;
    const r = this.#radius, t = this.#time;
    this.#root.position.copyFrom(this.#ball.position);
    this.#root.rotation.z = this.#ball.rotation.z * .8;
    const smooth = 1 - Math.exp(-16 * delta);
    const burst = motion.anticipating ? .15 : motion.boost;
    const speedPower = speedVisualPower(motion.speed, this.#baselineSpeed);
    this.#comet.update(t, speedPower, burst, this.#ball.scaling.y, motion.slow || this.#reduced);
    const arcTarget = motion.slow ? .8 : Math.max(Math.abs(motion.look) * .65, motion.anticipating ? 1 : burst * .45, this.#hurtAge < .4 ? .75 : 0);
    this.#arcAmount += (arcTarget - this.#arcAmount) * smooth;
    const windTarget = motion.slow ? 0 : Math.max(speedPower > 0 ? .18 + speedPower * .82 : 0, burst);
    this.#windAmount += (windTarget - this.#windAmount) * smooth;
    this.#arcs.forEach((arc, i) => {
      arc.visibility = this.#arcAmount * (this.#reduced ? .18 : i >= 2 && !motion.slow ? .4 : 1);
      arc.rotation.z = (this.#reduced ? 0 : t * (motion.slow ? .7 : 1.8) * (i % 2 ? -1 : 1)) + i * 1.6 + motion.look * .6;
      arc.rotation.x = motion.slow ? .55 + i * .15 : .1;
      arc.rotation.y = motion.slow ? .3 : motion.look * .4;
      arc.scaling.set(motion.anticipating ? 1.18 : 1, motion.anticipating ? .6 : 1, 1);
    });
    this.#wind.forEach((wind, i) => {
      const flame = clamp(speedPower * 1.5 - .2 + burst), pair = Math.floor((i - 3) / 2);
      const density = clamp(speedPower * 5 - pair + .2 + burst * 2);
      wind.visibility = this.#reduced ? 0 : this.#windAmount * (i < 3 ? .12 * flame : density);
      const crossSection = 1 / Math.sqrt(1 + speedPower * 2);
      wind.position.x = i < 3 ? (i - 1) * r * .3 : (i % 2 ? -1 : 1) * r * (.85 * crossSection + pair * .19);
      wind.position.y = r * ((t * (3 + speedPower * 7 + i * .2) + i * .17) % 1);
      wind.scaling.set(i < 3 ? .65 + this.#windAmount * .9 : .8 + speedPower * 2, 1 + speedPower * 2.7 + burst * .4, 1);
    });
    this.#dots.forEach((dot, i) => {
      const a = (this.#reduced ? 0 : t * .8) + i / 8 * Math.PI * 2;
      dot.visibility = motion.slow ? .85 : 0;
      dot.position.set(Math.cos(a) * r * 1.5, Math.sin(a) * r * 1.25, Math.sin(a) * r * .6);
    });
    this.#drops.forEach((drop, i) => {
      const p = (t * 1.4 + i * .25) % 1;
      drop.visibility = motion.danger && !this.#reduced ? Math.sin(p * Math.PI) * .8 : 0;
      drop.position.set((i % 2 ? -1 : 1) * r * (1.1 + p * .25), r * (.6 - p * .9), -r * .15);
    });
    const flash = clamp(this.#impactAge / .16);
    this.#flash.visibility = (1 - flash) * (this.#reduced ? .25 : .8);
    this.#flash.scaling.set(r * (1 + flash * 1.5), r * (.35 + flash * .35), r);
    for (const pool of [this.#stars, this.#shards]) for (const p of pool) {
      if (p.age >= p.life) { p.mesh.visibility = 0; continue; }
      p.age += delta; const progress = clamp(p.age / p.life);
      p.offset.addInPlaceFromFloats(p.velocity.x * delta, p.velocity.y * delta, p.velocity.z * delta);
      if (!p.follow) p.velocity.y -= r * 12 * delta;
      p.mesh.position.copyFrom(p.offset); if (p.follow) p.mesh.position.addInPlace(this.#ball.position);
      if (!this.#reduced) { p.mesh.rotation.z += delta * 2.5; p.mesh.rotation.y += delta * 1.5; }
      const scale = p.scale * (p.follow ? .5 + Math.sin(progress * Math.PI) * .7 : 1 - progress * .6);
      p.mesh.scaling.set(scale * (p.follow ? 1 : .65), scale * (p.follow ? 1 : 1.6), scale * (p.follow ? 1 : .5));
      p.mesh.visibility = (1 - progress) ** .6;
    }
  }

  public dispose(): void {
    this.#comet.dispose();
    this.#root.dispose();
    for (const pool of [this.#stars, this.#shards]) for (const p of pool) p.mesh.dispose();
    for (const material of this.#materials) material.dispose();
  }
}
