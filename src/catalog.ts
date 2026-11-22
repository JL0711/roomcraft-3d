import type { Item, ItemParams, ItemType } from './types';

export type Layer = 'floor' | 'upper' | 'opening' | 'curtain' | 'ceiling' | 'rug' | 'decor';

export interface CatalogEntry {
  type: ItemType;
  zh: string;
  en: string;
  /**
   * 'wall'    always sits against a wall
   * 'free'    snaps to a wall when dragged close, otherwise stands free (islands, beds, sofas)
   * 'floor'   never snaps to walls (dining sets, rugs, plants)
   * 'ceiling' hangs from the ceiling anywhere inside the room
   */
  snap: 'wall' | 'free' | 'floor' | 'ceiling';
  layer: Layer;
  size: { w: number; h: number; d: number; elev: number };
  range: { w: [number, number]; h: [number, number]; d: [number, number]; elev?: [number, number] };
  p: ItemParams;
}

const entry = (e: CatalogEntry) => e;

export const CATALOG: Record<ItemType, CatalogEntry> = {
  base: entry({
    type: 'base',
    zh: '地柜',
    en: 'Base cabinet',
    snap: 'free',
    layer: 'floor',
    size: { w: 0.8, h: 0.87, d: 0.58, elev: 0 },
    range: { w: [0.3, 2.4], h: [0.45, 0.95], d: [0.35, 0.95] },
    p: { doors: 2, layout: 'doors', style: 'flat', finish: 'lac-white', handle: 'bar', metal: 'steel', top: 'quartz', fixture: 'none' },
  }),
  wall: entry({
    type: 'wall',
    zh: '吊柜',
    en: 'Wall cabinet',
    snap: 'wall',
    layer: 'upper',
    size: { w: 0.8, h: 0.72, d: 0.35, elev: 1.45 },
    range: { w: [0.3, 2.4], h: [0.3, 1.1], d: [0.25, 0.45], elev: [1.2, 2.0] },
    p: { doors: 2, style: 'flat', finish: 'lac-white', handle: 'bar', metal: 'steel', led: true },
  }),
  tall: entry({
    type: 'tall',
    zh: '高柜',
    en: 'Tall cabinet',
    snap: 'free',
    layer: 'floor',
    size: { w: 0.6, h: 2.2, d: 0.58, elev: 0 },
    range: { w: [0.4, 1.2], h: [1.6, 2.6], d: [0.35, 0.65] },
    p: { doors: 1, style: 'flat', finish: 'lac-white', handle: 'bar', metal: 'steel', appliance: 'none' },
  }),
  wardrobe: entry({
    type: 'wardrobe',
    zh: '衣柜',
    en: 'Wardrobe',
    snap: 'wall',
    layer: 'floor',
    size: { w: 1.8, h: 2.3, d: 0.6, elev: 0 },
    range: { w: [0.8, 3.6], h: [1.8, 2.7], d: [0.5, 0.7] },
    p: { doors: 3, style: 'shaker', finish: 'oak', handle: 'bar', metal: 'black' },
  }),
  fridge: entry({
    type: 'fridge',
    zh: '冰箱',
    en: 'Fridge',
    snap: 'wall',
    layer: 'floor',
    size: { w: 0.9, h: 1.8, d: 0.7, elev: 0 },
    range: { w: [0.6, 1.0], h: [1.5, 2.0], d: [0.6, 0.75] },
    p: { metal: 'steel' },
  }),
  hood: entry({
    type: 'hood',
    zh: '油烟机',
    en: 'Range hood',
    snap: 'wall',
    layer: 'upper',
    size: { w: 0.9, h: 0.45, d: 0.5, elev: 1.6 },
    range: { w: [0.6, 1.2], h: [0.3, 0.7], d: [0.45, 0.6], elev: [1.4, 1.9] },
    p: { metal: 'steel' },
  }),
  bed: entry({
    type: 'bed',
    zh: '床',
    en: 'Bed',
    snap: 'free',
    layer: 'floor',
    size: { w: 1.6, h: 1.05, d: 2.1, elev: 0 },
    range: { w: [0.9, 2.0], h: [0.8, 1.4], d: [1.95, 2.2] },
    p: { fabric: 'linen', finish: 'oak', nightstands: true },
  }),
  sofa: entry({
    type: 'sofa',
    zh: '沙发',
    en: 'Sofa',
    snap: 'free',
    layer: 'floor',
    size: { w: 2.2, h: 0.82, d: 0.95, elev: 0 },
    range: { w: [1.5, 3.2], h: [0.7, 0.95], d: [0.8, 1.1] },
    p: { fabric: 'grey', metal: 'black' },
  }),
  dining: entry({
    type: 'dining',
    zh: '餐桌椅',
    en: 'Dining set',
    snap: 'floor',
    layer: 'floor',
    size: { w: 1.6, h: 0.75, d: 0.9, elev: 0 },
    range: { w: [1.0, 2.4], h: [0.75, 0.75], d: [0.75, 1.1] },
    p: { finish: 'oak', chairs: 6, fabric: 'linen', metal: 'black' },
  }),
  pendant: entry({
    type: 'pendant',
    zh: '吊灯',
    en: 'Pendant light',
    snap: 'ceiling',
    layer: 'ceiling',
    size: { w: 0.34, h: 0.85, d: 0.34, elev: 0 },
    range: { w: [0.2, 0.6], h: [0.2, 1.5], d: [0.2, 0.6] },
    p: { shade: 'dome', metal: 'black', temp: 2700, on: true },
  }),
  ceiling: entry({
    type: 'ceiling',
    zh: '吸顶灯',
    en: 'Ceiling light',
    snap: 'ceiling',
    layer: 'ceiling',
    size: { w: 0.45, h: 0.07, d: 0.45, elev: 0 },
    range: { w: [0.25, 0.8], h: [0.07, 0.07], d: [0.25, 0.8] },
    p: { temp: 4000, on: true },
  }),
  curtain: entry({
    type: 'curtain',
    zh: '窗帘',
    en: 'Curtains',
    snap: 'wall',
    layer: 'curtain',
    size: { w: 2.0, h: 2.5, d: 0.15, elev: 0 },
    range: { w: [0.8, 5], h: [1.0, 3.1], d: [0.15, 0.15] },
    p: { fabric: 'linen', open: 0.35, sheer: false, metal: 'black' },
  }),
  rug: entry({
    type: 'rug',
    zh: '地毯',
    en: 'Rug',
    snap: 'floor',
    layer: 'rug',
    size: { w: 2.4, h: 0.012, d: 1.7, elev: 0 },
    range: { w: [1, 4], h: [0.012, 0.012], d: [0.8, 3.2] },
    p: { fabric: 'linen' },
  }),
  plant: entry({
    type: 'plant',
    zh: '绿植',
    en: 'Plant',
    snap: 'floor',
    layer: 'floor',
    size: { w: 0.55, h: 1.35, d: 0.55, elev: 0 },
    range: { w: [0.3, 1.0], h: [0.4, 2.2], d: [0.3, 1.0] },
    p: {},
  }),
  tv: entry({
    type: 'tv',
    zh: '电视',
    en: 'TV',
    snap: 'wall',
    layer: 'decor',
    size: { w: 1.45, h: 0.83, d: 0.05, elev: 1.0 },
    range: { w: [0.8, 2.2], h: [0.45, 1.25], d: [0.05, 0.05], elev: [0.6, 1.8] },
    p: { on: true },
  }),
  window: entry({
    type: 'window',
    zh: '窗户',
    en: 'Window',
    snap: 'wall',
    layer: 'opening',
    size: { w: 1.5, h: 1.4, d: 0.12, elev: 0.9 },
    range: { w: [0.5, 4], h: [0.5, 2.2], d: [0.12, 0.12], elev: [0.05, 1.5] },
    p: { metal: 'black' },
  }),
  door: entry({
    type: 'door',
    zh: '门',
    en: 'Door',
    snap: 'wall',
    layer: 'opening',
    size: { w: 0.9, h: 2.1, d: 0.12, elev: 0 },
    range: { w: [0.7, 1.6], h: [1.9, 2.4], d: [0.12, 0.12] },
    p: { finish: 'lac-white', style: 'shaker', metal: 'black', open: 0.15 },
  }),
  model: entry({
    type: 'model',
    zh: '导入模型',
    en: 'Imported model',
    snap: 'free',
    layer: 'floor',
    size: { w: 1, h: 1, d: 1, elev: 0 },
    range: { w: [0.05, 8], h: [0.05, 4], d: [0.05, 8] },
    p: {},
  }),
};

export interface CatalogButton {
  type: ItemType;
  zh?: string;
  en?: string;
  p?: ItemParams;
  over?: Partial<Item>;
}

export const CATALOG_GROUPS: { zh: string; en: string; entries: CatalogButton[] }[] = [
  { zh: '橱柜', en: 'Cabinets', entries: [{ type: 'base' }, { type: 'wall' }, { type: 'tall' }, { type: 'wardrobe' }] },
  {
    zh: '厨房电器',
    en: 'Kitchen',
    entries: [
      { type: 'base', zh: '水槽柜', en: 'Sink unit', p: { fixture: 'sink' }, over: { w: 0.9 } },
      { type: 'base', zh: '灶台柜', en: 'Hob unit', p: { fixture: 'hob' }, over: { w: 0.9 } },
      { type: 'tall', zh: '烤箱高柜', en: 'Oven tower', p: { appliance: 'oven' } },
      { type: 'hood' },
      { type: 'fridge' },
    ],
  },
  { zh: '家具', en: 'Furniture', entries: [{ type: 'bed' }, { type: 'sofa' }, { type: 'dining' }, { type: 'plant' }] },
  { zh: '灯具', en: 'Lighting', entries: [{ type: 'pendant' }, { type: 'ceiling' }] },
  { zh: '软装', en: 'Soft furnishings', entries: [{ type: 'curtain' }, { type: 'rug' }, { type: 'tv' }] },
  { zh: '门窗', en: 'Doors & windows', entries: [{ type: 'window' }, { type: 'door' }] },
];

let counter = 0;
export const uid = () => `m${Date.now().toString(36)}${(counter++).toString(36)}`;

export function newItem(type: ItemType, over: Partial<Item> = {}, p: ItemParams = {}): Item {
  const c = CATALOG[type];
  return {
    id: uid(),
    type,
    x: 0,
    z: 0,
    rot: 0,
    w: c.size.w,
    h: c.size.h,
    d: c.size.d,
    elev: c.size.elev,
    wall: null,
    ...over,
    p: { ...c.p, ...p },
  };
}

export function shadeHeight(it: Item) {
  const r = it.w / 2;
  switch (it.p.shade) {
    case 'globe':
      return r * 2;
    case 'cylinder':
      return r * 1.25;
    default:
      return r * 0.62;
  }
}

export const CURTAIN_ROD_DROP = 0.1;
export const NIGHTSTAND_W = 0.46;
export const CHAIR_REACH = 0.55;

/** Vertical extent [bottom, top] of a module, in metres above the floor. */
export function itemSpan(it: Item, wallH: number): [number, number] {
  switch (it.type) {
    case 'base':
      return [0, it.h + (it.p.top && it.p.top !== 'none' ? 0.03 : 0)];
    case 'wall':
    case 'window':
    case 'tv':
      return [it.elev, it.elev + it.h];
    case 'hood':
      return [it.elev, wallH];
    case 'pendant':
      return [wallH - it.h - shadeHeight(it), wallH];
    case 'ceiling':
      return [wallH - it.h, wallH];
    case 'curtain': {
      const rod = wallH - CURTAIN_ROD_DROP;
      return [Math.max(0.01, rod - it.h), rod + 0.03];
    }
    case 'dining':
      return [0, 0.9];
    default:
      return [0, it.h];
  }
}

/** Width of the module footprint, including overhangs such as the curtain rod or nightstands. */
export function itemWidth(it: Item) {
  if (it.type === 'curtain') return it.w + 0.16;
  if (it.type === 'bed' && it.p.nightstands) return it.w + 2 * (NIGHTSTAND_W + 0.04);
  return it.w;
}

/** Depth of the module footprint (dining chairs pulled out from the table). */
export function itemDepth(it: Item) {
  if (it.type === 'dining') return it.d + 2 * CHAIR_REACH;
  return it.d;
}

export const NO_COLLIDE: Layer[] = ['curtain', 'opening', 'ceiling', 'rug', 'decor'];
