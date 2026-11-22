import { newItem, shadeHeight } from './catalog';
import { bounds, centroid, pointInPoly, projectOnWall, rayToWalls, wallsOf, type Wall } from './geometry';
import { placeOnWall } from './placement';
import type { Design, Item, RoomType, Vec2 } from './types';

const rect = (w: number, d: number): Vec2[] => [
  { x: -w / 2, z: -d / 2 },
  { x: w / 2, z: -d / 2 },
  { x: w / 2, z: d / 2 },
  { x: -w / 2, z: d / 2 },
];

export interface Preset {
  id: string;
  zh: string;
  en: string;
  roomType: RoomType;
  plan: Vec2[];
  floor: string;
  wallColor: string;
}

export const PRESETS: Preset[] = [
  { id: 'kitchen', zh: '开放式厨房 4.4×3.8 m', en: 'Open kitchen 4.4×3.8 m', roomType: 'kitchen', plan: rect(4.4, 3.8), floor: 'oak-plank', wallColor: '#e9e1d4' },
  { id: 'bedroom', zh: '主卧 4.0×3.6 m', en: 'Bedroom 4.0×3.6 m', roomType: 'bedroom', plan: rect(4.0, 3.6), floor: 'oak-plank', wallColor: '#e9e1d4' },
  {
    id: 'living',
    zh: 'L 形客餐厅',
    en: 'L-shaped living & dining',
    roomType: 'living',
    plan: [
      { x: -3, z: -2.4 },
      { x: 3, z: -2.4 },
      { x: 3, z: 0.6 },
      { x: 0.6, z: 0.6 },
      { x: 0.6, z: 2.4 },
      { x: -3, z: 2.4 },
    ],
    floor: 'tile-grey',
    wallColor: '#e9e1d4',
  },
];

export function designFromPreset(p: Preset): Design {
  const d: Design = {
    version: 1,
    plan: p.plan.map((v) => ({ ...v })),
    wallH: 2.7,
    floor: p.floor,
    wallColor: p.wallColor,
    roomType: p.roomType,
    items: [],
    meta: { client: '', address: '' },
  };
  d.items = autoLayout(d);
  return d;
}

/** Standard cabinet widths, greedily filling a run of wall. */
function fillWidths(len: number) {
  const opts = [0.9, 0.8, 0.6, 0.45, 0.4, 0.3];
  const out: number[] = [];
  let r = len;
  while (r >= 0.3 - 1e-6) {
    const pick = opts.find((o) => o <= r + 1e-6 && (r - o >= 0.3 - 1e-6 || r - o < 0.05)) ?? opts.find((o) => o <= r + 1e-6);
    if (!pick) break;
    out.push(pick);
    r -= pick;
  }
  return out;
}

const mid = (w: Wall): Vec2 => ({ x: (w.a.x + w.b.x) / 2, z: (w.a.z + w.b.z) / 2 });

/** The wall facing `main` across the room, preferring long ones. */
function oppositeWall(main: Wall, walls: Wall[]) {
  const m = mid(main);
  let best: Wall | null = null;
  let score = -Infinity;
  for (const w of walls) {
    if (w.i === main.i) continue;
    const facing = -(w.nIn.x * main.nIn.x + w.nIn.z * main.nIn.z);
    if (facing < 0.7) continue;
    const q = mid(w);
    const dist = (q.x - m.x) * main.nIn.x + (q.z - m.z) * main.nIn.z;
    const s = dist + w.len * 0.5;
    if (s > score) {
      score = s;
      best = w;
    }
  }
  return best;
}

/**
 * Standing point for the 360° view: from the middle of the room, step back
 * from the main (longest) wall so the camera takes in the whole feature wall.
 */
export function panoEye(d: Design): { eye: Vec2; look: Vec2 } {
  const walls = wallsOf(d.plan);
  const main = walls.slice().sort((a, b) => b.len - a.len)[0];
  const c = centroid(d.plan);
  const depth = rayToWalls(mid(main), main.nIn, walls, main.i);
  const look = { x: -main.nIn.x, z: -main.nIn.z };
  for (const k of [0.28, 0.18, 0.08, 0]) {
    const eye = { x: c.x + main.nIn.x * depth * k, z: c.z + main.nIn.z * depth * k };
    if (pointInPoly(eye, d.plan) && walls.every((w) => projectOnWall(eye, w).dist > 0.4)) return { eye, look };
  }
  return { eye: c, look };
}

/**
 * A side wall for the window, chosen so it faces the default camera (which
 * looks from the +x/+z corner); walls facing away from it are faded out.
 */
function featureWall(main: Wall, walls: Wall[], minLen: number) {
  const v = { x: 0.46, z: 0.89 };
  let best: Wall | null = null;
  let score = -Infinity;
  for (const w of walls) {
    if (w.i === main.i || w.len < minLen) continue;
    if (Math.abs(w.dir.x * main.dir.x + w.dir.z * main.dir.z) > 0.3) continue;
    const s = w.nIn.x * v.x + w.nIn.z * v.z + w.len * 0.05;
    if (s > score) {
      score = s;
      best = w;
    }
  }
  return best;
}

/** The point at least `clear` metres from every wall that is farthest from `from`. */
function farthestOpenSpot(plan: Vec2[], walls: Wall[], from: Vec2, clear: number): Vec2 | null {
  const b = bounds(plan);
  let best: Vec2 | null = null;
  let bestD = 0;
  for (let x = b.minX; x <= b.maxX; x += 0.2) {
    for (let z = b.minZ; z <= b.maxZ; z += 0.2) {
      const p = { x, z };
      if (!pointInPoly(p, plan)) continue;
      if (walls.some((w) => projectOnWall(p, w).dist < clear)) continue;
      const d = Math.hypot(x - from.x, z - from.z);
      if (d > bestD) {
        bestD = d;
        best = p;
      }
    }
  }
  return best;
}

/**
 * Rule-based furnishing. It looks at the room type and the wall lengths and
 * produces a complete starting layout. The output is plain JSON items, so a
 * language model could produce the same structure later.
 */
export function autoLayout(d: Design): Item[] {
  const walls = wallsOf(d.plan);
  const byLen = walls.slice().sort((a, b) => b.len - a.len);
  const main = byLen[0];
  const items: Item[] = [];
  const onWall = (it: Item, w: Wall, t: number) => {
    Object.assign(it, placeOnWall(it, w, t, items));
    items.push(it);
    return it;
  };
  const opp = oppositeWall(main, walls);
  const ctr = centroid(d.plan);
  const depth = rayToWalls(mid(main), main.nIn, walls, main.i);

  if (d.roomType === 'kitchen') {
    let t = 0;
    const lower = { finish: 'sage', style: 'shaker' as const, metal: 'brass' };
    if (main.len >= 3) {
      onWall(newItem('tall', { w: 0.6 }, lower), main, 0.3);
      t = 0.6;
    }
    const widths = fillWidths(main.len - t);
    widths.forEach((w, k) => {
      const drawers = k === 1 || (widths.length > 3 && k === widths.length - 2);
      onWall(newItem('base', { w }, { ...lower, doors: w >= 0.6 ? 2 : 1, layout: drawers ? 'drawers' : 'doors', top: 'marble' }), main, t + w / 2);
      onWall(newItem('wall', { w }, { doors: w >= 0.6 ? 2 : 1, metal: 'brass' }), main, t + w / 2);
      t += w;
    });
    const side = featureWall(main, walls, 2) ?? opp;
    if (side) onWall(newItem('window', { w: Math.min(1.6, side.len - 1.2), h: 1.2, elev: 1.0 }), side, side.len / 2);
    if (depth >= 3.4) {
      const off = 0.58 + 1.05 + 0.45;
      const c = { x: mid(main).x + main.nIn.x * off, z: mid(main).z + main.nIn.z * off };
      const iw = Math.min(2.2, main.len * 0.5);
      if (pointInPoly(c, d.plan)) {
        items.push(
          newItem(
            'base',
            { w: iw, d: 0.9, x: c.x, z: c.z, rot: Math.atan2(-main.nIn.x, -main.nIn.z), wall: null },
            { doors: Math.round(iw / 0.6), top: 'quartz', finish: 'walnut', style: 'fluted', handle: 'none' },
          ),
        );
        for (const s of [-1, 1]) {
          const p = newItem('pendant', { x: c.x + main.dir.x * s * iw * 0.27, z: c.z + main.dir.z * s * iw * 0.27 }, { metal: 'brass' });
          p.h = Math.max(0.3, d.wallH - 1.65 - shadeHeight(p));
          items.push(p);
        }
      }
    } else {
      items.push(newItem('ceiling', { x: ctr.x, z: ctr.z }));
    }
  } else if (d.roomType === 'bedroom') {
    const ww = Math.min(2.4, main.len - 0.4);
    onWall(newItem('wardrobe', { w: ww }, { doors: ww > 2 ? 4 : 3 }), main, ww / 2 + 0.1);
    const bSide = featureWall(main, walls, 2.2) ?? opp;
    if (bSide) {
      const winW = Math.min(1.8, bSide.len - 1);
      onWall(newItem('window', { w: winW, h: 1.6, elev: 0.6 }), bSide, bSide.len / 2);
      onWall(newItem('curtain', { w: Math.min(bSide.len - 0.3, winW + 0.6), h: d.wallH - 0.12 }, { fabric: 'grey' }), bSide, bSide.len / 2);
    }
    items.push(newItem('ceiling', { x: ctr.x, z: ctr.z }));
  } else {
    const tv = Math.min(2.2, main.len - 1);
    onWall(newItem('base', { w: tv, h: 0.48, d: 0.42 }, { layout: 'drawers', top: 'none', finish: 'walnut', handle: 'none' }), main, main.len / 2);
    onWall(newItem('tall', { w: 0.8, h: 2.2, d: 0.38 }, { doors: 2, finish: 'walnut', handle: 'none' }), main, 0.5);
    const lSide = featureWall(main, walls, 2.4) ?? opp;
    if (lSide) {
      const winW = Math.min(2.4, lSide.len - 1.2);
      onWall(newItem('window', { w: winW, h: 1.9, elev: 0.3 }), lSide, lSide.len / 2);
      onWall(newItem('curtain', { w: Math.min(lSide.len - 0.3, winW + 0.7), h: d.wallH - 0.12 }, { fabric: 'linen', sheer: true, open: 0.15 }), lSide, lSide.len / 2);
    }
    items.push(newItem('ceiling', { x: ctr.x, z: ctr.z }));
    // dining pendant in the open area farthest from the living zone
    const spot = farthestOpenSpot(d.plan, walls, ctr, 1.0);
    if (spot && Math.hypot(spot.x - ctr.x, spot.z - ctr.z) > 1.4) {
      const pd = newItem('pendant', { x: spot.x, z: spot.z, w: 0.42 }, { shade: 'globe', metal: 'brass' });
      pd.h = Math.max(0.3, d.wallH - 1.6 - shadeHeight(pd));
      items.push(pd);
    }
  }
  return items;
}
