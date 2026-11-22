import { CATALOG, itemSpan, itemWidth, newItem, type Layer } from './catalog';
import { centroid, clamp, nearestWall, pointInPoly, projectOnWall, wallsOf, type Wall } from './geometry';
import type { Design, Item, ItemType, Vec2 } from './types';

const SNAP_DIST = 0.08;
const layerOf = (it: Item): Layer => CATALOG[it.type].layer;
const cabinetLike = (l: Layer) => l === 'floor' || l === 'upper';

export interface Placement {
  x: number;
  z: number;
  rot: number;
  wall: number | null;
}

/** Puts a module flat against a wall at distance t along it, snapping to neighbours. */
export function placeOnWall(it: Item, w: Wall, t: number, all: Item[]): Placement {
  const half = itemWidth(it) / 2;
  let tc = w.len <= half * 2 ? w.len / 2 : clamp(t, half, w.len - half);
  const my = layerOf(it);
  const cands: number[] = [];
  for (const o of all) {
    if (o.id === it.id || o.wall !== w.i) continue;
    const ol = layerOf(o);
    const ot = projectOnWall(o, w).t;
    const oh = itemWidth(o) / 2;
    if (ol === my) cands.push(ot - oh - half, ot + oh + half);
    else if ((cabinetLike(ol) && cabinetLike(my)) || (my === 'curtain' && ol === 'opening') || (my === 'opening' && ol === 'curtain'))
      cands.push(ot - oh + half, ot + oh - half, ot);
  }
  let best = SNAP_DIST;
  let snapped = tc;
  for (const c of cands) {
    if (c < half - 1e-6 || c > w.len - half + 1e-6) continue;
    const dd = Math.abs(c - tc);
    if (dd < best) {
      best = dd;
      snapped = c;
    }
  }
  tc = snapped;
  const off = it.d / 2 + 0.002;
  return {
    x: w.a.x + w.dir.x * tc + w.nIn.x * off,
    z: w.a.z + w.dir.z * tc + w.nIn.z * off,
    rot: Math.atan2(w.nIn.x, w.nIn.z),
    wall: w.i,
  };
}

/** Where a module ends up when the user drags it to `target`. Returns null if not allowed. */
export function place(it: Item, target: Vec2, d: Design): Placement | null {
  const walls = wallsOf(d.plan);
  const c = CATALOG[it.type];
  if (c.snap === 'ceiling') {
    return pointInPoly(target, d.plan) ? { x: target.x, z: target.z, rot: it.rot, wall: null } : null;
  }
  const nw = nearestWall(target, walls);
  if (c.snap === 'free' && nw.dist > Math.max(0.75, it.d * 1.1)) {
    return pointInPoly(target, d.plan) ? { x: target.x, z: target.z, rot: it.rot, wall: null } : null;
  }
  return placeOnWall(it, nw.wall, nw.t, d.items);
}

/** Re-attach wall modules after the floor plan or a module size changed. */
export function reflowItem(it: Item, d: Design) {
  const walls = wallsOf(d.plan);
  if (it.wall !== null) {
    const nw = nearestWall(it, walls);
    Object.assign(it, placeOnWall(it, nw.wall, nw.t, d.items));
  } else if (CATALOG[it.type].snap === 'ceiling' && !pointInPoly(it, d.plan)) {
    Object.assign(it, centroid(d.plan));
  }
}

export function reflowAll(d: Design) {
  for (const it of d.items) reflowItem(it, d);
}

/** Finds a free spot for a newly added module: the widest gap on the longest walls. */
export function findSpot(type: ItemType, d: Design): Item {
  const it = newItem(type);
  const c = CATALOG[type];
  if (c.snap === 'ceiling') {
    const ctr = centroid(d.plan);
    const taken = d.items.filter((o) => CATALOG[o.type].layer === 'ceiling').length;
    const p = { x: ctr.x + (taken % 3) * 0.6 - (taken ? 0.6 : 0), z: ctr.z + Math.floor(taken / 3) * 0.6 };
    Object.assign(it, pointInPoly(p, d.plan) ? p : ctr);
    return it;
  }
  const walls = wallsOf(d.plan).slice().sort((a, b) => b.len - a.len);
  const my = c.layer;
  const w = itemWidth(it);
  for (const wall of walls) {
    const used = d.items
      .filter((o) => o.wall === wall.i && CATALOG[o.type].layer === my)
      .map((o) => {
        const t = projectOnWall(o, wall).t;
        const h = itemWidth(o) / 2;
        return [t - h, t + h] as [number, number];
      })
      .sort((a, b) => a[0] - b[0]);
    let cursor = 0;
    for (const [s, e] of [...used, [wall.len, wall.len] as [number, number]]) {
      if (s - cursor >= w - 1e-6) {
        Object.assign(it, placeOnWall(it, wall, cursor + w / 2, d.items));
        return it;
      }
      cursor = Math.max(cursor, e);
    }
  }
  Object.assign(it, placeOnWall(it, walls[0], walls[0].len / 2, d.items));
  return it;
}

/** Corners of a module footprint on the floor plan. */
export function footprint(it: Item): Vec2[] {
  const w = itemWidth(it) / 2;
  const h = it.d / 2;
  const c = Math.cos(it.rot);
  const s = Math.sin(it.rot);
  // local x axis -> (cos, -sin); local z axis -> (sin, cos)
  return [
    [-w, -h],
    [w, -h],
    [w, h],
    [-w, h],
  ].map(([lx, lz]) => ({ x: it.x + lx * c + lz * s, z: it.z - lx * s + lz * c }));
}

function overlap2D(a: Vec2[], b: Vec2[]) {
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i];
      const q = poly[(i + 1) % poly.length];
      const nx = q.z - p.z;
      const nz = p.x - q.x;
      const pa = a.map((v) => v.x * nx + v.z * nz);
      const pb = b.map((v) => v.x * nx + v.z * nz);
      if (Math.max(...pa) <= Math.min(...pb) + 1e-3 || Math.max(...pb) <= Math.min(...pa) + 1e-3) return false;
    }
  }
  return true;
}

/** True if a module collides with another one (same physical space, not just touching). */
export function collides(it: Item, d: Design) {
  const my = CATALOG[it.type].layer;
  if (my === 'curtain' || my === 'opening' || my === 'ceiling') return false;
  const [a0, a1] = itemSpan(it, d.wallH);
  const fa = footprint(it);
  return d.items.some((o) => {
    if (o.id === it.id) return false;
    const ol = CATALOG[o.type].layer;
    if (ol === 'curtain' || ol === 'opening' || ol === 'ceiling') return false;
    const [b0, b1] = itemSpan(o, d.wallH);
    if (a1 <= b0 + 1e-3 || b1 <= a0 + 1e-3) return false;
    return overlap2D(fa, footprint(o));
  });
}
