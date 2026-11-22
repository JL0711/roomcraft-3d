export type Lang = 'zh' | 'en';

/** A point on the floor plan, in metres. 2D "z" maps to the 3D z axis. */
export interface Vec2 {
  x: number;
  z: number;
}

export type ItemType =
  | 'base'
  | 'wall'
  | 'tall'
  | 'wardrobe'
  | 'pendant'
  | 'ceiling'
  | 'curtain'
  | 'window';

export type DoorStyle = 'flat' | 'shaker' | 'fluted';
export type HandleStyle = 'bar' | 'knob' | 'none';
export type ShadeStyle = 'dome' | 'globe' | 'cylinder';
export type RoomType = 'kitchen' | 'bedroom' | 'living';

export interface ItemParams {
  // cabinets
  doors?: number;
  layout?: 'doors' | 'drawers';
  style?: DoorStyle;
  finish?: string;
  color?: string; // custom paint colour, overrides finish
  handle?: HandleStyle;
  metal?: string;
  top?: string;
  led?: boolean;
  // lights
  shade?: ShadeStyle;
  temp?: number;
  on?: boolean;
  // curtains
  fabric?: string;
  open?: number;
  sheer?: boolean;
}

/**
 * Every module is positioned by the centre of its footprint (x, z) and a
 * rotation about Y. Local +z is the front of the module; the back sits
 * against the wall it is snapped to.
 */
export interface Item {
  id: string;
  type: ItemType;
  x: number;
  z: number;
  rot: number;
  w: number;
  h: number;
  d: number;
  elev: number;
  wall: number | null;
  p: ItemParams;
}

export interface Design {
  version: 1;
  plan: Vec2[];
  wallH: number;
  floor: string;
  wallColor: string;
  roomType: RoomType;
  items: Item[];
  meta: { client: string; address: string };
}
