import * as THREE from 'three';
import type { Vec2 } from './types';

export const WALL_T = 0.12;

export interface Wall {
  i: number;
  a: Vec2;
  b: Vec2;
  len: number;
  dir: Vec2;
  /** unit normal pointing into the room */
  nIn: Vec2;
}

export function signedArea(p: Vec2[]) {
  let s = 0;
  for (let i = 0; i < p.length; i++) {
    const a = p[i];
    const b = p[(i + 1) % p.length];
    s += a.x * b.z - b.x * a.z;
  }
  return s / 2;
}

export const area = (p: Vec2[]) => Math.abs(signedArea(p));

export function perimeter(p: Vec2[]) {
  return p.reduce((s, a, i) => {
    const b = p[(i + 1) % p.length];
    return s + Math.hypot(b.x - a.x, b.z - a.z);
  }, 0);
}

export function wallsOf(p: Vec2[]): Wall[] {
  const ccw = signedArea(p) > 0;
  return p.map((a, i) => {
    const b = p[(i + 1) % p.length];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len = Math.hypot(dx, dz) || 1e-6;
    const dir = { x: dx / len, z: dz / len };
    const nIn = ccw ? { x: -dir.z, z: dir.x } : { x: dir.z, z: -dir.x };
    return { i, a, b, len, dir, nIn };
  });
}

/** Outer corners of the wall band, mitred so any room shape closes cleanly. */
export function outerPoints(p: Vec2[], T = WALL_T): Vec2[] {
  const W = wallsOf(p);
  const n = p.length;
  return p.map((v, i) => {
    const w0 = W[(i - 1 + n) % n];
    const w1 = W[i];
    const p0 = { x: v.x - w0.nIn.x * T, z: v.z - w0.nIn.z * T };
    const p1 = { x: v.x - w1.nIn.x * T, z: v.z - w1.nIn.z * T };
    const cross = w0.dir.x * w1.dir.z - w0.dir.z * w1.dir.x;
    if (Math.abs(cross) < 1e-4) return p1;
    const dx = p1.x - p0.x;
    const dz = p1.z - p0.z;
    const s = (dx * w1.dir.z - dz * w1.dir.x) / cross;
    let q = { x: p0.x + w0.dir.x * s, z: p0.z + w0.dir.z * s };
    const dist = Math.hypot(q.x - v.x, q.z - v.z);
    if (dist > T * 4) {
      const k = (T * 4) / dist;
      q = { x: v.x + (q.x - v.x) * k, z: v.z + (q.z - v.z) * k };
    }
    return q;
  });
}

export function centroid(p: Vec2[]): Vec2 {
  const A = signedArea(p);
  if (Math.abs(A) < 1e-6) {
    const s = p.reduce((acc, v) => ({ x: acc.x + v.x, z: acc.z + v.z }), { x: 0, z: 0 });
    return { x: s.x / p.length, z: s.z / p.length };
  }
  let cx = 0;
  let cz = 0;
  for (let i = 0; i < p.length; i++) {
    const a = p[i];
    const b = p[(i + 1) % p.length];
    const f = a.x * b.z - b.x * a.z;
    cx += (a.x + b.x) * f;
    cz += (a.z + b.z) * f;
  }
  return { x: cx / (6 * A), z: cz / (6 * A) };
}

export function bounds(p: Vec2[]) {
  const xs = p.map((v) => v.x);
  const zs = p.map((v) => v.z);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) };
}

export function pointInPoly(q: Vec2, p: Vec2[]) {
  let inside = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const a = p[i];
    const b = p[j];
    if (a.z > q.z !== b.z > q.z && q.x < ((b.x - a.x) * (q.z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
}

/** Distance along the wall (t, unclamped) and distance from the wall line segment. */
export function projectOnWall(q: Vec2, w: Wall) {
  const t = (q.x - w.a.x) * w.dir.x + (q.z - w.a.z) * w.dir.z;
  const tc = Math.max(0, Math.min(w.len, t));
  const px = w.a.x + w.dir.x * tc;
  const pz = w.a.z + w.dir.z * tc;
  return { t, dist: Math.hypot(q.x - px, q.z - pz) };
}

export function nearestWall(q: Vec2, walls: Wall[]) {
  let best = walls[0];
  let bestD = Infinity;
  let bestT = 0;
  for (const w of walls) {
    const { t, dist } = projectOnWall(q, w);
    if (dist < bestD) {
      bestD = dist;
      best = w;
      bestT = t;
    }
  }
  return { wall: best, t: bestT, dist: bestD };
}

/** Distance from a point along a direction to the first wall it hits. */
export function rayToWalls(o: Vec2, d: Vec2, walls: Wall[], skip: number) {
  let best = Infinity;
  for (const w of walls) {
    if (w.i === skip) continue;
    const ex = w.b.x - w.a.x;
    const ez = w.b.z - w.a.z;
    const den = d.x * ez - d.z * ex;
    if (Math.abs(den) < 1e-9) continue;
    const ax = w.a.x - o.x;
    const az = w.a.z - o.z;
    const s = (ax * ez - az * ex) / den;
    const u = (ax * d.z - az * d.x) / den;
    if (s > 1e-4 && u >= 0 && u <= 1) best = Math.min(best, s);
  }
  return best;
}

const boxCache = new Map<string, THREE.BoxGeometry>();

/** Box geometry whose UVs are in metres, so textures keep their real scale. */
export function boxGeo(w: number, h: number, d: number) {
  const key = `${Math.round(w * 1000)}:${Math.round(h * 1000)}:${Math.round(d * 1000)}`;
  let g = boxCache.get(key);
  if (!g) {
    g = new THREE.BoxGeometry(w, h, d);
    const uv = g.attributes.uv as THREE.BufferAttribute;
    const dims = [
      [d, h],
      [d, h],
      [w, d],
      [w, d],
      [w, h],
      [w, h],
    ];
    for (let f = 0; f < 6; f++) {
      for (let k = 0; k < 4; k++) {
        const i = f * 4 + k;
        uv.setXY(i, uv.getX(i) * dims[f][0], uv.getY(i) * dims[f][1]);
      }
    }
    uv.needsUpdate = true;
    boxCache.set(key, g);
  }
  return g;
}

export const snap = (v: number, step: number) => Math.round(v / step) * step;
export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
export const mm = (m: number) => Math.round(m * 1000);
