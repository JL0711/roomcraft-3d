import { CATALOG, newItem, shadeHeight } from './catalog';
import { bounds, centroid, pointInPoly, projectOnWall, rayToWalls, wallsOf, type Wall } from './geometry';
import { footprint, placeOnWall } from './placement';
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
  { id: 'bedroom', zh: '主卧 4.6×3.8 m', en: 'Bedroom 4.6×3.8 m', roomType: 'bedroom', plan: rect(4.6, 3.8), floor: 'oak-plank', wallColor: '#e3ddd3' },
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
    floor: 'oak-plank',
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
  // ideal spot: a little back from the middle of the room, facing the main wall
  const ideal = { x: c.x + main.nIn.x * depth * 0.22, z: c.z + main.nIn.z * depth * 0.22 };
  const blockers = d.items.filter((it) => ['floor'].includes(CATALOG[it.type].layer)).map((it) => footprint(it));
  const b = bounds(d.plan);
  let best: Vec2 | null = null;
  let bestScore = Infinity;
  for (let x = b.minX; x <= b.maxX; x += 0.15) {
    for (let z = b.minZ; z <= b.maxZ; z += 0.15) {
      const p = { x, z };
      if (!pointInPoly(p, d.plan)) continue;
      if (walls.some((w) => projectOnWall(p, w).dist < 0.7)) continue;
      // keep clear of furniture so it does not fill the foreground
      if (blockers.some((fp) => distToPoly(p, fp) < 0.45)) continue;
      const s = Math.hypot(x - ideal.x, z - ideal.z);
      if (s < bestScore) {
        bestScore = s;
        best = p;
      }
    }
  }
  return { eye: best ?? (pointInPoly(ideal, d.plan) ? ideal : c), look };
}

function distToPoly(p: Vec2, poly: Vec2[]) {
  if (pointInPoly(p, poly)) return 0;
  let m = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz || 1)));
    m = Math.min(m, Math.hypot(p.x - (a.x + dx * t), p.z - (a.z + dz * t)));
  }
  return m;
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

const at = (w: Wall, t: number, s: number): Vec2 => ({ x: w.a.x + w.dir.x * t + w.nIn.x * s, z: w.a.z + w.dir.z * t + w.nIn.z * s });
/** rotation that turns a module's front towards wall w */
const facingWall = (w: Wall) => Math.atan2(-w.nIn.x, -w.nIn.z);
/** rotation that lines a free-standing module up with wall w, front into the room */
const alongWall = (w: Wall) => Math.atan2(w.nIn.x, w.nIn.z);

function fits(it: Item, plan: Vec2[], others: Item[]) {
  if (!footprint(it).every((p) => pointInPoly(p, plan))) return false;
  return !others.some((o) => o.type !== 'rug' && o.type !== 'pendant' && o.type !== 'ceiling' && overlaps(footprint(it), footprint(o)));
}
function overlaps(a: Vec2[], b: Vec2[]) {
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

/** Inside corner of wall w at the end farthest from the main wall, stepped in by `inset`. */
function farCorner(w: Wall, main: Wall, inset: number): Vec2 {
  const dist = (p: Vec2) => (p.x - main.a.x) * main.nIn.x + (p.z - main.a.z) * main.nIn.z;
  return dist(w.a) > dist(w.b) ? at(w, inset, inset) : at(w, w.len - inset, inset);
}

/** A wall for the door: not the main or window wall, at least 1.4 m long, the shortest such. */
function doorWall(walls: Wall[], used: number[]) {
  return walls.filter((w) => !used.includes(w.i) && w.len >= 1.4).sort((a, b) => a.len - b.len)[0] ?? null;
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
  const side = featureWall(main, walls, 2) ?? opp;
  const addDoor = (tFrac: number) => {
    const dw = doorWall(walls, [main.i, side?.i ?? -1]);
    if (dw) onWall(newItem('door'), dw, Math.max(0.6, Math.min(dw.len - 0.6, dw.len * tFrac)));
  };
  const addPlant = (h = 1.35) => {
    if (!side) return;
    const c = farCorner(side, main, 0.45);
    const pl = newItem('plant', { x: c.x, z: c.z, h });
    if (fits(pl, d.plan, items)) items.push(pl);
  };

  if (d.roomType === 'kitchen') {
    const lower = { finish: 'sage', style: 'shaker' as const, metal: 'brass' };
    let t = 0;
    if (main.len >= 3) {
      onWall(newItem('tall', { w: 0.6 }, { ...lower, appliance: 'oven' }), main, 0.3);
      t = 0.6;
    }
    const fridge = main.len >= 3.6;
    const widths = fillWidths(main.len - t - (fridge ? 0.9 : 0));
    let hobDone = false;
    let sinkDone = false;
    widths.forEach((w, k) => {
      let fixture: 'none' | 'sink' | 'hob' = 'none';
      if (!hobDone && w >= 0.8) {
        fixture = 'hob';
        hobDone = true;
      } else if (!sinkDone && w >= 0.8 && k >= 2) {
        fixture = 'sink';
        sinkDone = true;
      }
      const drawers = fixture === 'none' && k === 1;
      onWall(newItem('base', { w }, { ...lower, doors: w >= 0.6 ? 2 : 1, layout: drawers ? 'drawers' : 'doors', top: 'marble', fixture }), main, t + w / 2);
      if (fixture === 'hob') onWall(newItem('hood', { w }), main, t + w / 2);
      else onWall(newItem('wall', { w }, { doors: w >= 0.6 ? 2 : 1, metal: 'brass' }), main, t + w / 2);
      t += w;
    });
    if (fridge) onWall(newItem('fridge', { w: 0.9 }), main, main.len - 0.45);
    if (side) onWall(newItem('window', { w: Math.min(1.6, side.len - 1.4), h: 1.2, elev: 1.0 }), side, side.len / 2);
    if (depth >= 3.4) {
      const off = 0.58 + 1.05 + 0.45;
      const c = { x: mid(main).x + main.nIn.x * off, z: mid(main).z + main.nIn.z * off };
      const iw = Math.min(2.2, main.len * 0.5);
      if (pointInPoly(c, d.plan)) {
        items.push(
          newItem(
            'base',
            { w: iw, d: 0.9, x: c.x, z: c.z, rot: facingWall(main), wall: null },
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
    addDoor(0.75);
    addPlant(1.1);
  } else if (d.roomType === 'bedroom') {
    const ww = Math.min(1.6, main.len * 0.34);
    onWall(newItem('wardrobe', { w: ww }, { doors: ww > 1.4 ? 3 : 2 }), main, ww / 2 + 0.05);
    const bed = newItem('bed', { w: main.len - ww >= 2.7 ? 1.6 : 1.4 }, { fabric: 'grey', finish: 'oak', nightstands: main.len - ww >= 2.5 });
    const bedSpan = bed.w + (bed.p.nightstands ? 1.0 : 0);
    const tb = ww + 0.1 + (main.len - ww - 0.1) / 2;
    onWall(bed, main, Math.min(main.len - bedSpan / 2, Math.max(ww + 0.1 + bedSpan / 2, tb)));
    const tBed = (bed.x - main.a.x) * main.dir.x + (bed.z - main.a.z) * main.dir.z;
    const rp = at(main, tBed, bed.d * 0.78);
    items.push(newItem('rug', { x: rp.x, z: rp.z, w: Math.min(2.6, bed.w + 1.0), d: 1.8, rot: alongWall(main) }, { fabric: 'blush' }));
    if (side) {
      const winW = Math.min(1.8, side.len - 1.4);
      onWall(newItem('window', { w: winW, h: 1.6, elev: 0.6 }), side, side.len / 2);
      onWall(newItem('curtain', { w: Math.min(side.len - 0.3, winW + 0.6), h: d.wallH - 0.12 }, { fabric: 'grey' }), side, side.len / 2);
    }
    const cl = at(main, tBed, Math.min(depth * 0.5, 2.2));
    items.push(newItem('ceiling', { x: cl.x, z: cl.z }));
    addDoor(0.8);
    addPlant(1.2);
  } else {
    const tTV = main.len >= 4.5 ? main.len * 0.32 : main.len / 2;
    const tvW = Math.min(2.0, main.len * 0.4);
    onWall(newItem('base', { w: tvW, h: 0.48, d: 0.42 }, { layout: 'drawers', top: 'none', finish: 'walnut', handle: 'none' }), main, tTV);
    onWall(newItem('tv', { w: 1.45, h: 0.83, elev: 0.95 }), main, tTV);
    const room = rayToWalls(at(main, tTV, 0.01), main.nIn, walls, main.i);
    const sDist = Math.max(2.2, Math.min(3.0, room - 0.6));
    const sp = at(main, tTV, sDist);
    const sofa = newItem('sofa', { x: sp.x, z: sp.z, rot: facingWall(main), w: Math.min(2.4, main.len * 0.4) }, { fabric: 'grey' });
    if (fits(sofa, d.plan, items)) items.push(sofa);
    const rp = at(main, tTV, sDist * 0.6);
    items.push(newItem('rug', { x: rp.x, z: rp.z, w: 2.4, d: 1.7, rot: alongWall(main) }, { fabric: 'grey' }));
    const cl = at(main, tTV, sDist * 0.55);
    items.push(newItem('ceiling', { x: cl.x, z: cl.z }));
    if (side) {
      const winW = Math.min(2.4, side.len - 1.6);
      onWall(newItem('window', { w: winW, h: 1.9, elev: 0.3 }), side, side.len / 2);
      onWall(newItem('curtain', { w: Math.min(side.len - 0.3, winW + 0.7), h: d.wallH - 0.12 }, { fabric: 'linen', sheer: true, open: 0.15 }), side, side.len / 2);
    }
    // dining at the other end of the main wall, or the most open spot left
    const tryDining = (p: Vec2, rot: number) => {
      const dn = newItem('dining', { x: p.x, z: p.z, rot });
      return fits(dn, d.plan, items) ? dn : null;
    };
    let dining = main.len >= 4.5 ? tryDining(at(main, main.len * 0.8, 1.45), alongWall(main)) : null;
    if (!dining) {
      const spot = farthestOpenSpot(d.plan, walls, sp, 1.15);
      if (spot) dining = tryDining(spot, alongWall(main)) ?? tryDining(spot, alongWall(main) + Math.PI / 2);
    }
    if (dining) {
      items.push(dining);
      const pd = newItem('pendant', { x: dining.x, z: dining.z, w: 0.42 }, { shade: 'globe', metal: 'brass' });
      pd.h = Math.max(0.3, d.wallH - 1.6 - shadeHeight(pd));
      items.push(pd);
    }
    const pp = at(main, tTV + tvW / 2 + 0.4, 0.35);
    const plant = newItem('plant', { x: pp.x, z: pp.z, h: 1.5 });
    if (fits(plant, d.plan, items)) items.push(plant);
    addDoor(0.5);
  }
  return items;
}
