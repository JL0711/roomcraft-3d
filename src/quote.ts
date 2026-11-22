import { CATALOG } from './catalog';
import { area, mm, perimeter } from './geometry';
import { tr, nameOf } from './i18n';
import { BACKSPLASHES, FABRICS, findById, FINISHES, FLOORS, METALS, TOPS } from './materials';
import { computeRuns } from './runs';
import type { Design, Item, Lang } from './types';

export interface QLine {
  itemId?: string;
  name: string;
  spec: string;
  qty: number;
  unit: string;
  price: number;
  amount: number;
  installable: boolean;
}

export interface Quote {
  lines: QLine[];
  install: number;
  subtotal: number;
  gst: number;
  total: number;
  floorArea: number;
  wallArea: number;
}

/** Demo rates in SGD. A real deployment would load these from the company's price list. */
export const RATES = {
  base: 680, // per metre of run
  wall: 450,
  tall: 980, // per metre at 2.2 m high
  wardrobe: 1150, // per metre at 2.4 m high
  shaker: 1.12,
  fluted: 1.18,
  customColour: 1.08,
  drawerColumn: 160,
  handle: { bar: 18, knob: 12, none: 25 },
  led: 45, // per metre
  pendant: { dome: 220, globe: 260, cylinder: 240 },
  brass: 40,
  ceiling: 160,
  curtainRod: 85,
  sheer: 0.8,
  sink: 680, // sink and tap
  hob: 1280,
  oven: 1450,
  fridge: 2400,
  fridgeBlack: 200,
  hood: 980,
  bed: 1350, // queen 1.6 m
  nightstand: 340, // with lamp
  sofa: 1600, // 2.2 m three-seater
  table: 750, // 1.6 m
  chair: 180,
  rug: 85, // per m²
  plant: 120,
  door: 680,
  doubleDoor: 1180,
  paint: 6.5, // per m²
  install: 0.12,
  gst: 0.09,
};

const r2 = (n: number) => Math.round(n * 100) / 100;

function handles(it: Item) {
  const n = Math.max(1, it.p.doors ?? 1);
  if (it.type === 'base' && it.p.layout === 'drawers') return (it.w > 1 ? 2 : 1) * (it.h < 0.6 ? 2 : 3);
  if (it.type === 'tall' && it.h > 1.7) return n * 2;
  return n;
}

export function itemPrice(it: Item): number {
  const p = it.p;
  switch (it.type) {
    case 'base':
    case 'wall':
    case 'tall':
    case 'wardrobe': {
      const f = findById(FINISHES, p.finish);
      let rate = RATES[it.type];
      if (it.type === 'tall') rate *= it.h / 2.2;
      if (it.type === 'wardrobe') rate *= it.h / 2.4;
      let v = rate * it.w * (p.color ? RATES.customColour : f.factor);
      if (p.style === 'shaker') v *= RATES.shaker;
      if (p.style === 'fluted') v *= RATES.fluted;
      if (it.type === 'base' && p.layout === 'drawers') v += RATES.drawerColumn * (it.w > 1 ? 2 : 1);
      v += handles(it) * RATES.handle[p.handle ?? 'bar'];
      if (it.type === 'wall' && p.led) v += RATES.led * it.w;
      if (it.type === 'base' && p.fixture === 'sink') v += RATES.sink;
      if (it.type === 'base' && p.fixture === 'hob') v += RATES.hob;
      if (it.type === 'tall' && p.appliance === 'oven') v += RATES.oven;
      return r2(v);
    }
    case 'fridge':
      return RATES.fridge + (p.metal === 'black' ? RATES.fridgeBlack : 0);
    case 'hood':
      return RATES.hood;
    case 'bed':
      return r2(RATES.bed + (it.w - 1.6) * 900 + (p.nightstands ? 2 * RATES.nightstand : 0));
    case 'sofa':
      return r2((RATES.sofa * it.w) / 2.2);
    case 'dining':
      return r2((RATES.table * it.w) / 1.6 + RATES.chair * (p.chairs ?? 6));
    case 'rug':
      return r2(RATES.rug * it.w * it.d);
    case 'plant':
      return RATES.plant;
    case 'door':
      return it.w > 1.0 ? RATES.doubleDoor : RATES.door;
    case 'pendant':
      return RATES.pendant[p.shade ?? 'dome'] + (p.metal === 'brass' ? RATES.brass : 0);
    case 'ceiling':
      return RATES.ceiling;
    case 'curtain': {
      const f = findById(FABRICS, p.fabric);
      return r2(f.rate * it.w * (p.sheer ? RATES.sheer : 1) + RATES.curtainRod);
    }
    default:
      return 0;
  }
}

export function itemSpec(it: Item, lang: Lang): string {
  const t = (k: Parameters<typeof tr>[1]) => tr(lang, k);
  const p = it.p;
  const size = `${mm(it.w)}×${mm(it.h)}×${mm(it.d)} mm`;
  const parts = [size];
  if (['base', 'wall', 'tall', 'wardrobe'].includes(it.type)) {
    parts.push(p.color ? `${t('customColor')} ${p.color}` : nameOf(lang, findById(FINISHES, p.finish)));
    parts.push(t(p.style ?? 'flat'));
    if (it.type === 'base' && p.layout === 'drawers') parts.push(t('layoutDrawers'));
    else parts.push(`${p.doors ?? 1} ${t('doorsUnit')}`);
    parts.push(`${t('handle')}: ${t(p.handle ?? 'bar')}${p.handle === 'none' ? '' : ' / ' + nameOf(lang, findById(METALS, p.metal))}`);
    if (it.type === 'wall' && p.led) parts.push(t('led'));
    if (it.type === 'base' && p.fixture === 'sink') parts.push(t('sink'));
    if (it.type === 'base' && p.fixture === 'hob') parts.push(t('hob'));
    if (it.type === 'tall' && p.appliance === 'oven') parts.push(t('oven'));
  } else if (it.type === 'pendant') {
    parts.splice(0, 1, `Ø${mm(it.w)} mm`, `${t('drop')} ${mm(it.h)} mm`);
    parts.push(t(p.shade ?? 'dome'), nameOf(lang, findById(METALS, p.metal)), `${p.temp ?? 2700}K`);
  } else if (it.type === 'ceiling') {
    parts.splice(0, 1, `Ø${mm(it.w)} mm`);
    parts.push(`${p.temp ?? 4000}K`);
  } else if (it.type === 'fridge' || it.type === 'hood') {
    parts.push(nameOf(lang, findById(METALS, p.metal)));
  } else if (it.type === 'bed') {
    parts.push(nameOf(lang, findById(FABRICS, p.fabric)), nameOf(lang, findById(FINISHES, p.finish)));
    if (p.nightstands) parts.push(t('nightstands'));
  } else if (it.type === 'sofa') {
    parts.push(nameOf(lang, findById(FABRICS, p.fabric)));
  } else if (it.type === 'dining') {
    parts.push(nameOf(lang, findById(FINISHES, p.finish)), `${p.chairs ?? 6} ${t('chairs')}`, nameOf(lang, findById(FABRICS, p.fabric)));
  } else if (it.type === 'rug') {
    parts.splice(0, 1, `${mm(it.w)}×${mm(it.d)} mm`);
    parts.push(nameOf(lang, findById(FABRICS, p.fabric)));
  } else if (it.type === 'door') {
    parts.splice(0, 1, `${mm(it.w)}×${mm(it.h)} mm`);
    parts.push(nameOf(lang, findById(FINISHES, p.finish)), t(p.style ?? 'flat'));
  } else if (it.type === 'model') {
    parts.push(p.modelName ?? '', t('clientOwn'), t('notPriced'));
  } else if (it.type === 'curtain') {
    parts.splice(0, 1, `${mm(it.w)}×${mm(it.h)} mm`);
    parts.push(p.sheer ? t('sheer') : nameOf(lang, findById(FABRICS, p.fabric)), t('rod'));
  }
  return parts.join(' · ');
}

export function buildQuote(d: Design, lang: Lang): Quote {
  const lines: QLine[] = [];
  const order = ['base', 'wall', 'tall', 'wardrobe', 'fridge', 'hood', 'bed', 'sofa', 'dining', 'pendant', 'ceiling', 'curtain', 'rug', 'plant', 'door', 'model'];
  const items = d.items.filter((i) => order.includes(i.type)).sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));
  for (const it of items) {
    const price = itemPrice(it);
    lines.push({
      itemId: it.id,
      name: nameOf(lang, CATALOG[it.type]),
      spec: itemSpec(it, lang),
      qty: 1,
      unit: tr(lang, 'pcs'),
      price,
      amount: price,
      installable: it.type !== 'model',
    });
  }
  // worktops, grouped by material
  const runs = new Map<string, number>();
  for (const it of d.items) if (it.type === 'base' && it.p.top && it.p.top !== 'none') runs.set(it.p.top, (runs.get(it.p.top) ?? 0) + it.w);
  for (const [id, len] of runs) {
    const top = findById(TOPS, id);
    const qty = r2(len);
    lines.push({ name: tr(lang, 'worktop'), spec: `${nameOf(lang, top)} · 30 mm`, qty, unit: tr(lang, 'm'), price: top.rate, amount: r2(qty * top.rate), installable: true });
  }
  const splash = findById(BACKSPLASHES, d.backsplash ?? 'subway');
  const splashArea = r2(computeRuns(d).reduce((s, r) => s + r.len * r.splashH, 0));
  if (splashArea > 0 && splash.rate > 0) {
    lines.push({ name: tr(lang, 'backsplash'), spec: nameOf(lang, splash), qty: splashArea, unit: tr(lang, 'sqm'), price: splash.rate, amount: r2(splashArea * splash.rate), installable: true });
  }
  const floorArea = r2(area(d.plan));
  const fl = findById(FLOORS, d.floor);
  lines.push({ name: tr(lang, 'flooring'), spec: nameOf(lang, fl), qty: floorArea, unit: tr(lang, 'sqm'), price: fl.rate, amount: r2(floorArea * fl.rate), installable: false });
  const openings = d.items.filter((i) => i.type === 'window' || i.type === 'door').reduce((s, i) => s + i.w * i.h, 0);
  const wallArea = r2(Math.max(0, perimeter(d.plan) * d.wallH - openings));
  lines.push({ name: tr(lang, 'painting'), spec: d.wallColor.toUpperCase(), qty: wallArea, unit: tr(lang, 'sqm'), price: RATES.paint, amount: r2(wallArea * RATES.paint), installable: false });

  const goods = lines.reduce((s, l) => s + l.amount, 0);
  const install = r2(lines.filter((l) => l.installable).reduce((s, l) => s + l.amount, 0) * RATES.install);
  const subtotal = r2(goods + install);
  const gst = r2(subtotal * RATES.gst);
  return { lines, install, subtotal, gst, total: r2(subtotal + gst), floorArea, wallArea };
}

export const money = (n: number) => `S$ ${n.toLocaleString('en-SG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
