export const WATER_SPLASH_SECONDS = .9;

// A fixed mesh batch: no particles, meshes, random calls or array allocations per frame.
// The burst is staged: membrane tears -> crown / water sheets -> flying droplets -> ripples.
const DROPS = 32;
const JETS = 6;
const JET_SEGMENTS = 9;
const CROWN = 14;
const MEMBRANE = 20;
const RING_SEGMENTS = 32;
const RINGS = 2;
const JET_START = DROPS;
const CROWN_START = JET_START + JETS * JET_SEGMENTS;
const MEMBRANE_START = CROWN_START + CROWN;
const RING_START = MEMBRANE_START + MEMBRANE;
const QUADS = RING_START + RING_SEGMENTS * RINGS;
const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));

/** Local XY geometry with one quad per element. waterData.x selects the shader
 * shape: 0 = rounded/tapered droplet, 1 = liquid ribbon, 2 = translucent film.
 * waterData.y is the element alpha. All typed buffers are kept for pool reuse. */
export class WaterSplashGeometry {
  readonly positions = new Float32Array(QUADS * 12);
  readonly waterData = new Float32Array(QUADS * 8);
  readonly uvs = new Float32Array(QUADS * 8);
  readonly indices: number[] = [];

  public constructor() {
    for (let i = 0; i < QUADS; i++) {
      this.uvs.set([0, 0, 1, 0, 1, 1, 0, 1], i * 8);
      const n = i * 4;
      this.indices.push(n, n + 1, n + 2, n, n + 2, n + 3);
    }
  }

  public update(age: number, force: number, contactX: number, groundY: number, reduced: boolean): number {
    this.positions.fill(0);
    this.waterData.fill(0);
    if (!Number.isFinite(age) || age < 0 || age >= WATER_SPLASH_SECONDS) return 0;

    // Hidden quads remain local to the impact; there is only one bounds refresh.
    for (let i = 0; i < QUADS * 4; i++) {
      this.positions[i * 3] = contactX;
      this.positions[i * 3 + 1] = groundY;
    }
    const motion = reduced ? .32 : 1;
    const strength = .78 + Math.max(.7, Math.min(1.6, Number.isFinite(force) ? force : 1)) * .27;

    // Size hierarchy: a few heavy masses carry the silhouette; fine satellite
    // droplets add detail with deterministic stagger, avoiding frame-to-frame noise.
    for (let i = 0; i < DROPS; i++) {
      if (reduced && i >= 8) continue;
      const group = Math.floor(i / 2);
      const direction = i % 2 === 0 ? -1 : 1;
      const spread = (group * .6180339 + .16) % 1;
      const lift = (group * .41421356 + .09) % 1;
      const small = group >= 8;
      const start = (small ? .055 : .008) + lift * (small ? .085 : .04);
      const t = age - start;
      if (t < 0) continue;
      const vx = direction * (1.55 + spread * 4.5) * strength * motion;
      const vy = (6.2 + lift * 2.5 + (small ? .6 : 0)) * strength * motion;
      const gravity = 9.8 * motion;
      const x = contactX + vx * t;
      const y = groundY + vy * t - gravity * t * t;
      const velocityY = vy - 2 * gravity * t;
      const speed = Math.max(.001, Math.hypot(vx, velocityY));
      const radius = (small ? .021 + spread * .02 : .058 + spread * .056) * (reduced ? .88 : 1);
      const length = radius * (small ? 1.3 : 1.6 + Math.min(1.0, speed * .13));
      const fadeAt = small ? .61 : .73;
      const alpha = clamp01((fadeAt - t) / (small ? .18 : .2));
      if (alpha <= 0) continue;
      this.#drop(i, x, y, radius, length, vx / speed, velocityY / speed, alpha);
    }

    // Curved-feeling, tapered water sheets briefly connect the impact with the
    // outward spray. Their tail catches up to the head, so they break apart.
    const jetFade = clamp01((.46 - age) / .16);
    for (let jet = 0; jet < JETS; jet++) {
      if (reduced && jet >= 2) continue;
      if (jetFade <= 0) continue;
      const direction = jet % 2 === 0 ? -1 : 1;
      const band = Math.floor(jet / 2);
      const vx = direction * (3.5 + band * .9) * strength * motion;
      const vy = (6.4 + band * .8) * strength * motion;
      const tail = Math.max(0, age - .18);
      const head = Math.min(age, .34);
      if (head <= tail) continue;
      for (let s = 0; s < JET_SEGMENTS; s++) {
        const a = tail + (head - tail) * s / JET_SEGMENTS;
        const b = tail + (head - tail) * (s + 1) / JET_SEGMENTS;
        const width = (.11 + band * .025) * (1 - .66 * s / JET_SEGMENTS) * motion;
        this.#ribbon(JET_START + jet * JET_SEGMENTS + s,
          contactX + vx * a * (1 + .3 * a), groundY + vy * a - 9.8 * motion * a * a,
          contactX + vx * b * (1 + .3 * b), groundY + vy * b - 9.8 * motion * b * b,
          width, width * .82, jetFade * .92);
      }
    }

    // Asymmetric crown: broad low petals on the sides and tall narrow ones near
    // the center. It grows very quickly and vanishes before the flying droplets.
    const crownFade = clamp01((.29 - age) / .16);
    if (crownFade > 0) {
      for (let i = 0; i < CROWN; i++) {
        if (reduced && i % 3 !== 0) continue;
        const a = Math.PI * (.08 + .84 * (i + .5) / CROWN);
        const wave = .86 + .14 * Math.sin(i * 2.7);
        const reach = (.27 + age * 5.1) * strength * motion * wave;
        const base = Math.cos(a) * .14 * motion;
        const tipX = contactX + Math.cos(a) * reach;
        const tipY = groundY + Math.sin(a) * reach * .92 - age * age * 3.0 * motion;
        this.#ribbon(CROWN_START + i, contactX + base, groundY - .035,
          tipX, tipY, (.115 + (i % 3) * .016) * motion, .024 * motion,
          crownFade * .88);
      }
    }

    // Shimmering torn film is distinct from opaque water. Unlike a generic
    // explosion, it briefly remembers the curved shell of the popped bubble.
    const filmFade = clamp01((.24 - age) / .13);
    if (!reduced && filmFade > 0) {
      for (let i = 0; i < MEMBRANE; i++) {
        const side = i % 2 === 0 ? -1 : 1;
        const f = (Math.floor(i / 2) + .5) / (MEMBRANE / 2);
        const x = contactX + side * ((.17 + f * .85) + age * (1.1 + f * 2.0)) * strength;
        const y = groundY + .16 + Math.sin(f * Math.PI) * (.22 + age * 1.5) * strength - age * age * 5.0;
        const dx = side * (.12 + .08 * f) * filmFade;
        const dy = (.09 + .1 * Math.sin(f * Math.PI)) * filmFade;
        this.#ribbon(MEMBRANE_START + i, x - dx, y - dy, x + dx, y + dy,
          .035 * filmFade, .022 * filmFade, filmFade * .76, 2);
      }
    }

    // Two thin, time-offset ellipse ripples, never a full-screen flash.
    for (let ring = 0; ring < RINGS; ring++) {
      if (reduced && ring > 0) continue;
      const t = age - ring * .085;
      if (t < 0 || t >= .76) continue;
      const fade = clamp01((.76 - t) / .35) * Math.min(1, t / .055);
      const rx = (.23 + t * 4.3) * strength * motion;
      const ry = (.085 + t * .56) * motion;
      const width = (.05 - .018 * t) * motion;
      for (let i = 0; i < RING_SEGMENTS; i++) {
        const a = i * Math.PI * 2 / RING_SEGMENTS;
        const b = (i + 1) * Math.PI * 2 / RING_SEGMENTS;
        this.#ribbon(RING_START + ring * RING_SEGMENTS + i,
          contactX + Math.cos(a) * rx, groundY + Math.sin(a) * ry,
          contactX + Math.cos(b) * rx, groundY + Math.sin(b) * ry,
          width, width, fade * (ring ? .35 : .62));
      }
    }
    return clamp01((WATER_SPLASH_SECONDS - age) / .2);
  }

  #drop(slot: number, x: number, y: number, halfWidth: number, halfLength: number, vx: number, vy: number, alpha: number): void {
    const ax = vy * halfWidth, ay = -vx * halfWidth;
    const bx = vx * halfLength, by = vy * halfLength;
    this.#quad(slot, x - ax - bx, y - ay - by, x + ax - bx, y + ay - by,
      x + ax + bx, y + ay + by, x - ax + bx, y - ay + by, 0, alpha);
  }

  #ribbon(slot: number, ax: number, ay: number, bx: number, by: number, wa: number, wb: number, alpha: number, shape = 1): void {
    const length = Math.max(.0001, Math.hypot(bx - ax, by - ay));
    const nx = -(by - ay) / length, ny = (bx - ax) / length;
    this.#quad(slot, ax - nx * wa, ay - ny * wa, ax + nx * wa, ay + ny * wa,
      bx + nx * wb, by + ny * wb, bx - nx * wb, by - ny * wb, shape, alpha);
  }

  #quad(slot: number, ax: number, ay: number, bx: number, by: number, cx: number, cy: number,
    dx: number, dy: number, shape: number, alpha: number): void {
    const p = slot * 12;
    this.positions[p] = ax; this.positions[p + 1] = ay; this.positions[p + 2] = 0;
    this.positions[p + 3] = bx; this.positions[p + 4] = by; this.positions[p + 5] = 0;
    this.positions[p + 6] = cx; this.positions[p + 7] = cy; this.positions[p + 8] = 0;
    this.positions[p + 9] = dx; this.positions[p + 10] = dy; this.positions[p + 11] = 0;
    for (let i = 0; i < 4; i++) {
      this.waterData[slot * 8 + i * 2] = shape;
      this.waterData[slot * 8 + i * 2 + 1] = alpha;
    }
  }
}
