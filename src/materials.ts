import * as THREE from 'three';
import { fluteNormal, getTexture, hobTexture, rugTexture, screenTexture, skyTexture, type TexKind } from './textures';

export interface Named {
  id: string;
  zh: string;
  en: string;
}

export interface FinishDef extends Named {
  color?: string;
  tex?: TexKind;
  rough: number;
  gloss?: boolean;
  /** price multiplier against the base cabinet rate */
  factor: number;
}

export const FINISHES: FinishDef[] = [
  { id: 'lac-white', zh: '白色烤漆', en: 'White lacquer', color: '#f2f0eb', rough: 0.32, gloss: true, factor: 1 },
  { id: 'matte-grey', zh: '暖灰哑光', en: 'Warm grey matte', color: '#a39c92', rough: 0.85, factor: 1.05 },
  { id: 'sage', zh: '鼠尾草绿', en: 'Sage green', color: '#8e9d86', rough: 0.8, factor: 1.05 },
  { id: 'navy', zh: '深海蓝', en: 'Navy', color: '#2f3c54', rough: 0.55, factor: 1.05 },
  { id: 'black', zh: '哑光黑', en: 'Matte black', color: '#2a2a2b', rough: 0.8, factor: 1.1 },
  { id: 'oak', zh: '橡木饰面', en: 'Oak veneer', tex: 'oak', rough: 0.62, factor: 1.25 },
  { id: 'walnut', zh: '胡桃木饰面', en: 'Walnut veneer', tex: 'walnut', rough: 0.58, factor: 1.45 },
];

export interface TopDef extends Named {
  tex?: TexKind;
  rough: number;
  /** SGD per metre of run */
  rate: number;
}

export const TOPS: TopDef[] = [
  { id: 'quartz', zh: '白色石英石', en: 'White quartz', tex: 'quartz', rough: 0.22, rate: 420 },
  { id: 'marble', zh: '卡拉拉大理石', en: 'Carrara marble', tex: 'marble', rough: 0.18, rate: 650 },
  { id: 'granite', zh: '黑色花岗岩', en: 'Black granite', tex: 'granite', rough: 0.28, rate: 380 },
  { id: 'butcher', zh: '实木台面', en: 'Butcher block', tex: 'oak', rough: 0.5, rate: 300 },
  { id: 'none', zh: '无台面', en: 'No worktop', rough: 1, rate: 0 },
];

export interface FloorDef extends Named {
  tex: TexKind;
  rough: number;
  /** SGD per m² */
  rate: number;
}

export const FLOORS: FloorDef[] = [
  { id: 'oak-plank', zh: '橡木地板', en: 'Oak planks', tex: 'plank', rough: 0.55, rate: 95 },
  { id: 'tile-grey', zh: '60×60 灰色瓷砖', en: 'Grey tiles 60×60', tex: 'tile', rough: 0.3, rate: 75 },
  { id: 'terrazzo', zh: '水磨石', en: 'Terrazzo', tex: 'terrazzo', rough: 0.35, rate: 110 },
  { id: 'microcement', zh: '微水泥', en: 'Microcement', tex: 'concrete', rough: 0.7, rate: 130 },
];

export interface MetalDef extends Named {
  color: string;
  rough: number;
  metal: number;
}

export const METALS: MetalDef[] = [
  { id: 'steel', zh: '拉丝不锈钢', en: 'Brushed steel', color: '#c9c9c7', rough: 0.32, metal: 1 },
  { id: 'brass', zh: '黄铜', en: 'Brass', color: '#c9a35a', rough: 0.28, metal: 1 },
  { id: 'black', zh: '哑光黑', en: 'Matte black', color: '#232323', rough: 0.55, metal: 0.5 },
];

export interface FabricDef extends Named {
  color: string;
  /** SGD per metre of track */
  rate: number;
}

export const FABRICS: FabricDef[] = [
  { id: 'linen', zh: '亚麻米白', en: 'Linen', color: '#e6ddcd', rate: 95 },
  { id: 'grey', zh: '雾灰', en: 'Mist grey', color: '#9b9b98', rate: 95 },
  { id: 'navy', zh: '藏蓝遮光', en: 'Navy blackout', color: '#2e3a52', rate: 120 },
  { id: 'blush', zh: '藕粉', en: 'Blush', color: '#d8b2a6', rate: 95 },
];

export const WALL_COLORS = ['#f3f1ec', '#e9e1d4', '#dbdbd7', '#c8d0c1', '#d7b8a2', '#b8c3cb'];

export interface SplashDef extends Named {
  tex?: TexKind;
  rough: number;
  /** SGD per m² */
  rate: number;
}

export const BACKSPLASHES: SplashDef[] = [
  { id: 'subway', zh: '白色地铁砖', en: 'White subway tile', tex: 'subway', rough: 0.15, rate: 120 },
  { id: 'zellige', zh: '绿色手工砖', en: 'Green zellige', tex: 'zellige', rough: 0.12, rate: 180 },
  { id: 'marble', zh: '大理石背板', en: 'Marble slab', tex: 'marble', rough: 0.2, rate: 260 },
  { id: 'none', zh: '不做背板', en: 'None', rough: 1, rate: 0 },
];

export function findById<T extends Named>(list: T[], id: string | undefined): T {
  return list.find((x) => x.id === id) ?? list[0];
}

const cache = new Map<string, THREE.Material>();
function cached<T extends THREE.Material>(key: string, make: () => T): T {
  let m = cache.get(key) as T | undefined;
  if (!m) {
    m = make();
    cache.set(key, m);
  }
  return m;
}

export function finishMat(id: string | undefined, custom: string | undefined, fluted: boolean) {
  return cached(`fin:${id}:${custom ?? ''}:${fluted}`, () => {
    const f = findById(FINISHES, id);
    const params: THREE.MeshPhysicalMaterialParameters = { roughness: f.rough, metalness: 0 };
    if (custom) {
      params.color = new THREE.Color(custom);
      params.roughness = 0.6;
    } else if (f.tex) params.map = getTexture(f.tex);
    else params.color = new THREE.Color(f.color);
    if (f.gloss && !custom) {
      params.clearcoat = 0.6;
      params.clearcoatRoughness = 0.15;
    }
    if (fluted) {
      params.normalMap = fluteNormal();
      params.normalScale = new THREE.Vector2(1.3, 1.3);
    }
    return new THREE.MeshPhysicalMaterial(params);
  });
}

export function topMat(id: string | undefined) {
  return cached(`top:${id}`, () => {
    const t = findById(TOPS, id);
    return new THREE.MeshPhysicalMaterial({
      map: t.tex ? getTexture(t.tex) : null,
      roughness: t.rough,
      clearcoat: t.id === 'butcher' ? 0 : 0.35,
      clearcoatRoughness: 0.2,
    });
  });
}

export function floorMat(id: string) {
  return cached(`floor:${id}`, () => {
    const f = findById(FLOORS, id);
    return new THREE.MeshStandardMaterial({ map: getTexture(f.tex), roughness: f.rough });
  });
}

export function metalMat(id: string | undefined) {
  return cached(`metal:${id}`, () => {
    const m = findById(METALS, id);
    return new THREE.MeshStandardMaterial({ color: m.color, roughness: m.rough, metalness: m.metal });
  });
}

export function fabricMat(id: string | undefined, sheer: boolean) {
  return cached(`fabric:${id}:${sheer}`, () => {
    const f = findById(FABRICS, id);
    return new THREE.MeshPhysicalMaterial({
      color: sheer ? '#f4f1ea' : f.color,
      roughness: 0.95,
      sheen: 0.6,
      sheenRoughness: 0.8,
      sheenColor: new THREE.Color('#ffffff'),
      side: THREE.DoubleSide,
      transparent: sheer,
      opacity: sheer ? 0.55 : 1,
      depthWrite: !sheer,
    });
  });
}

export function plainMat(color: string, rough = 0.8, metal = 0) {
  return cached(`plain:${color}:${rough}:${metal}`, () => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal }));
}

export function glowMat(color: THREE.Color, intensity: number) {
  return cached(`glow:${color.getHexString()}:${intensity}`, () =>
    new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: color, emissiveIntensity: intensity, roughness: 0.5 }),
  );
}

export function skyMat(night: boolean) {
  return cached(`sky:${night}`, () => new THREE.MeshBasicMaterial({ map: skyTexture(night) }));
}

export function glassMat() {
  return cached('glass', () =>
    new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.03, metalness: 0, transparent: true, opacity: 0.12, depthWrite: false }),
  );
}

/** Approximate black-body colour for a light colour temperature in kelvin. */
export function kelvin(k: number): THREE.Color {
  const t = k / 100;
  let r: number;
  let g: number;
  let b: number;
  if (t <= 66) {
    r = 255;
    g = 99.4708025861 * Math.log(t) - 161.1195681661;
    b = t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  } else {
    r = 329.698727446 * Math.pow(t - 60, -0.1332047592);
    g = 288.1221695283 * Math.pow(t - 60, -0.0755148492);
    b = 255;
  }
  const c = (v: number) => Math.min(255, Math.max(0, v)) / 255;
  return new THREE.Color().setRGB(c(r), c(g), c(b), THREE.SRGBColorSpace);
}

export function splashMat(id: string | undefined) {
  return cached(`splash:${id}`, () => {
    const s = findById(BACKSPLASHES, id);
    return new THREE.MeshPhysicalMaterial({ map: s.tex ? getTexture(s.tex) : null, roughness: s.rough, clearcoat: 0.5, clearcoatRoughness: 0.1 });
  });
}

export function hobMat() {
  return cached('hob', () => new THREE.MeshPhysicalMaterial({ map: hobTexture(), roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.05 }));
}

export function rugMat(id: string | undefined) {
  const f = findById(FABRICS, id);
  return cached(`rug:${f.id}`, () => new THREE.MeshStandardMaterial({ map: rugTexture(f.color), roughness: 1 }));
}

export function screenMat(on: boolean) {
  return cached(`screen:${on}`, () =>
    on
      ? new THREE.MeshStandardMaterial({ color: '#000000', emissive: '#ffffff', emissiveMap: screenTexture(), emissiveIntensity: 0.9, roughness: 0.2 })
      : new THREE.MeshPhysicalMaterial({ color: '#0b0b0c', roughness: 0.1, clearcoat: 1 }),
  );
}

/** Upholstery: the fabric colour, optionally with channel tufting from the flute normal map. */
export function upholsteryMat(id: string | undefined, channels = false) {
  return cached(`uph:${id}:${channels}`, () => {
    const f = findById(FABRICS, id);
    return new THREE.MeshPhysicalMaterial({
      color: f.color,
      roughness: 0.92,
      sheen: 0.7,
      sheenRoughness: 0.7,
      sheenColor: new THREE.Color('#ffffff'),
      normalMap: channels ? fluteNormal() : null,
      normalScale: new THREE.Vector2(2.2, 2.2),
    });
  });
}
