import type { Item, ItemParams, ItemType } from './types';

export type Layer = 'floor' | 'upper' | 'opening' | 'curtain' | 'ceiling';

export interface CatalogEntry {
  type: ItemType;
  zh: string;
  en: string;
  /** 'wall' modules always sit against a wall; 'free' ones may stand alone (e.g. an island) */
  snap: 'wall' | 'free' | 'ceiling';
  layer: Layer;
  size: { w: number; h: number; d: number; elev: number };
  range: { w: [number, number]; h: [number, number]; d: [number, number]; elev?: [number, number] };
  p: ItemParams;
}

export const CATALOG: Record<ItemType, CatalogEntry> = {
  base: {
    type: 'base',
    zh: '地柜',
    en: 'Base cabinet',
    snap: 'free',
    layer: 'floor',
    size: { w: 0.8, h: 0.87, d: 0.58, elev: 0 },
    range: { w: [0.3, 2.4], h: [0.45, 0.95], d: [0.35, 0.95] },
    p: { doors: 2, layout: 'doors', style: 'flat', finish: 'lac-white', handle: 'bar', metal: 'steel', top: 'quartz' },
  },
  wall: {
    type: 'wall',
    zh: '吊柜',
    en: 'Wall cabinet',
    snap: 'wall',
    layer: 'upper',
    size: { w: 0.8, h: 0.72, d: 0.35, elev: 1.45 },
    range: { w: [0.3, 2.4], h: [0.3, 1.1], d: [0.25, 0.45], elev: [1.2, 2.0] },
    p: { doors: 2, style: 'flat', finish: 'lac-white', handle: 'bar', metal: 'steel', led: true },
  },
  tall: {
    type: 'tall',
    zh: '高柜',
    en: 'Tall cabinet',
    snap: 'free',
    layer: 'floor',
    size: { w: 0.6, h: 2.2, d: 0.58, elev: 0 },
    range: { w: [0.4, 1.2], h: [1.6, 2.6], d: [0.35, 0.65] },
    p: { doors: 1, style: 'flat', finish: 'lac-white', handle: 'bar', metal: 'steel' },
  },
  wardrobe: {
    type: 'wardrobe',
    zh: '衣柜',
    en: 'Wardrobe',
    snap: 'wall',
    layer: 'floor',
    size: { w: 1.8, h: 2.3, d: 0.6, elev: 0 },
    range: { w: [0.8, 3.6], h: [1.8, 2.7], d: [0.5, 0.7] },
    p: { doors: 3, style: 'shaker', finish: 'oak', handle: 'bar', metal: 'black' },
  },
  pendant: {
    type: 'pendant',
    zh: '吊灯',
    en: 'Pendant light',
    snap: 'ceiling',
    layer: 'ceiling',
    size: { w: 0.34, h: 0.85, d: 0.34, elev: 0 },
    range: { w: [0.2, 0.6], h: [0.2, 1.5], d: [0.2, 0.6] },
    p: { shade: 'dome', metal: 'black', temp: 2700, on: true },
  },
  ceiling: {
    type: 'ceiling',
    zh: '吸顶灯',
    en: 'Ceiling light',
    snap: 'ceiling',
    layer: 'ceiling',
    size: { w: 0.45, h: 0.07, d: 0.45, elev: 0 },
    range: { w: [0.25, 0.8], h: [0.07, 0.07], d: [0.25, 0.8] },
    p: { temp: 4000, on: true },
  },
  curtain: {
    type: 'curtain',
    zh: '窗帘',
    en: 'Curtains',
    snap: 'wall',
    layer: 'curtain',
    size: { w: 2.0, h: 2.5, d: 0.15, elev: 0 },
    range: { w: [0.8, 5], h: [1.0, 3.1], d: [0.15, 0.15] },
    p: { fabric: 'linen', open: 0.35, sheer: false, metal: 'black' },
  },
  window: {
    type: 'window',
    zh: '窗户',
    en: 'Window',
    snap: 'wall',
    layer: 'opening',
    size: { w: 1.5, h: 1.4, d: 0.06, elev: 0.9 },
    range: { w: [0.5, 4], h: [0.5, 2.2], d: [0.06, 0.06], elev: [0, 1.5] },
    p: { metal: 'black' },
  },
};

export const CATALOG_ORDER: ItemType[] = ['base', 'wall', 'tall', 'wardrobe', 'pendant', 'ceiling', 'curtain', 'window'];

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

/** Vertical extent [bottom, top] of a module, in metres above the floor. */
export function itemSpan(it: Item, wallH: number): [number, number] {
  switch (it.type) {
    case 'base':
      return [0, it.h + (it.p.top && it.p.top !== 'none' ? 0.03 : 0)];
    case 'wall':
    case 'window':
      return [it.elev, it.elev + it.h];
    case 'pendant':
      return [wallH - it.h - shadeHeight(it), wallH];
    case 'ceiling':
      return [wallH - it.h, wallH];
    case 'curtain': {
      const rod = wallH - CURTAIN_ROD_DROP;
      return [Math.max(0.01, rod - it.h), rod + 0.03];
    }
    default:
      return [0, it.h];
  }
}

/** Width of the module footprint, including overhangs such as the curtain rod. */
export function itemWidth(it: Item) {
  return it.type === 'curtain' ? it.w + 0.16 : it.w;
}
