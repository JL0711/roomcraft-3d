import { CATALOG } from './catalog';
import { projectOnWall, signedArea, wallsOf, type SlabHole, type Wall } from './geometry';
import type { Design, Item } from './types';

export const SINK_Z = 0.03;
export const sinkW = (it: Item) => Math.min(it.w - 0.16, 0.76);
export const sinkD = (it: Item) => Math.min(0.42, it.d - 0.16);

/**
 * A continuous worktop over neighbouring base cabinets on one wall, plus
 * the backsplash above it. Local frame: x along the wall, z into the room,
 * origin at the wall surface, so tiles and stone run unbroken across units.
 */
export interface Run {
  key: string;
  wall: Wall;
  origin: { x: number; z: number };
  rot: number;
  /** distance along the wall where local x = 0 (used to align tiles) */
  u0: number;
  len: number;
  depth: number;
  h: number;
  top: string;
  holes: SlabHole[];
  /** backsplash height above the worktop (0 = none) */
  splashH: number;
}

export function computeRuns(d: Design): Run[] {
  const walls = wallsOf(d.plan);
  const ccw = signedArea(d.plan) > 0;
  const out: Run[] = [];
  for (const w of walls) {
    const bases = d.items
      .filter((it) => it.type === 'base' && it.wall === w.i && it.p.top && it.p.top !== 'none')
      .map((it) => ({ it, t: projectOnWall(it, w).t }))
      .sort((a, b) => a.t - b.t);
    type Group = { top: string; h: number; t0: number; t1: number; depth: number; items: typeof bases };
    const groups: Group[] = [];
    for (const b of bases) {
      const t0 = b.t - b.it.w / 2;
      const t1 = b.t + b.it.w / 2;
      const g = groups[groups.length - 1];
      if (g && g.top === b.it.p.top && Math.abs(g.h - b.it.h) < 0.002 && t0 - g.t1 < 0.01) {
        g.t1 = Math.max(g.t1, t1);
        g.depth = Math.max(g.depth, b.it.d);
        g.items.push(b);
      } else groups.push({ top: b.it.p.top!, h: b.it.h, t0, t1, depth: b.it.d, items: [b] });
    }
    for (const g of groups) {
      const originT = ccw ? g.t0 : g.t1;
      const X = ccw ? w.dir : { x: -w.dir.x, z: -w.dir.z };
      const xOf = (t: number) => (ccw ? t - g.t0 : g.t1 - t);
      const holes = g.items
        .filter((b) => b.it.p.fixture === 'sink')
        .map((b) => ({ x: xOf(b.t), y: b.it.d / 2 + 0.002 + SINK_Z, w: sinkW(b.it), d: sinkD(b.it) }));
      // backsplash runs up to the wall units (or hood) above, or 60 cm if there are none
      const worktop = g.h + 0.03;
      let topY = Infinity;
      for (const o of d.items) {
        if (o.wall !== w.i) continue;
        const layer = CATALOG[o.type].layer;
        if (!(layer === 'upper' || o.type === 'window')) continue;
        const ot = projectOnWall(o, w).t;
        if (ot + o.w / 2 <= g.t0 + 0.01 || ot - o.w / 2 >= g.t1 - 0.01) continue;
        if (o.elev > worktop) topY = Math.min(topY, o.elev);
      }
      const splashH = (d.backsplash ?? 'subway') === 'none' ? 0 : Math.max(0, Math.min(isFinite(topY) ? topY : worktop + 0.6, d.wallH) - worktop);
      out.push({
        key: `${w.i}:${g.t0.toFixed(3)}`,
        wall: w,
        origin: { x: w.a.x + w.dir.x * originT, z: w.a.z + w.dir.z * originT },
        rot: Math.atan2(-X.z, X.x),
        u0: ccw ? g.t0 : -g.t1,
        len: g.t1 - g.t0,
        depth: g.depth + 0.022,
        h: g.h,
        top: g.top,
        holes,
        splashH,
      });
    }
  }
  return out;
}
