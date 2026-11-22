import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { CURTAIN_ROD_DROP, shadeHeight } from '../catalog';
import { boxGeo, slabGeo } from '../geometry';
import { SINK_Z, sinkD, sinkW } from '../runs';
import {
  BedModel,
  DiningModel,
  DoorModel,
  FridgeModel,
  HoodModel,
  PlantModel,
  RugModel,
  SofaModel,
  TVModel,
  WindowModel,
} from './furniture';
import { ImportedModel } from './imported';
import {
  fabricMat,
  finishMat,
  glowMat,
  hobMat,
  kelvin,
  metalMat,
  plainMat,
  topMat,
} from '../materials';
import type { Item } from '../types';

function Box(props: { w: number; h: number; d: number; x?: number; y?: number; z?: number; mat: THREE.Material; shadow?: boolean }) {
  const { w, h, d, x = 0, y = 0, z = 0, mat, shadow = true } = props;
  return <mesh geometry={boxGeo(w, h, d)} material={mat} position={[x, y, z]} castShadow={shadow} receiveShadow />;
}

interface Front {
  x: number;
  y: number;
  w: number;
  h: number;
  orient: 'h' | 'v';
  hx: number;
  hy: number;
  hlen: number;
}

const T = 0.018; // door thickness
const GAP = 0.003;

function DoorPanel({ f, z, style, mat }: { f: Front; z: number; style: string | undefined; mat: THREE.Material }) {
  if (style !== 'shaker') return <Box w={f.w} h={f.h} d={T} x={f.x} y={f.y} z={z} mat={mat} />;
  const fr = Math.min(0.065, f.w * 0.2, f.h * 0.25);
  return (
    <group>
      <Box w={fr} h={f.h} d={T} x={f.x - f.w / 2 + fr / 2} y={f.y} z={z} mat={mat} />
      <Box w={fr} h={f.h} d={T} x={f.x + f.w / 2 - fr / 2} y={f.y} z={z} mat={mat} />
      <Box w={f.w - fr * 2} h={fr} d={T} x={f.x} y={f.y + f.h / 2 - fr / 2} z={z} mat={mat} />
      <Box w={f.w - fr * 2} h={fr} d={T} x={f.x} y={f.y - f.h / 2 + fr / 2} z={z} mat={mat} />
      <Box w={f.w - fr * 2} h={f.h - fr * 2} d={T * 0.5} x={f.x} y={f.y} z={z - T * 0.22} mat={mat} />
    </group>
  );
}

function Handle({ f, z, kind, mat }: { f: Front; z: number; kind: string | undefined; mat: THREE.Material }) {
  if (kind === 'none') return null;
  const zf = z + T / 2;
  if (kind === 'knob') {
    return (
      <group position={[f.hx, f.hy, zf]}>
        <mesh material={mat} position={[0, 0, 0.022]} castShadow>
          <sphereGeometry args={[0.014, 20, 14]} />
        </mesh>
        <mesh material={mat} position={[0, 0, 0.01]} rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.005, 0.005, 0.02, 10]} />
        </mesh>
      </group>
    );
  }
  const L = f.hlen;
  const horizontal = f.orient === 'h';
  return (
    <group position={[f.hx, f.hy, zf]}>
      <mesh material={mat} position={[0, 0, 0.024]} rotation-z={horizontal ? Math.PI / 2 : 0} castShadow>
        <cylinderGeometry args={[0.0065, 0.0065, L, 14]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh
          key={s}
          material={mat}
          position={[horizontal ? (s * L) / 2 - s * 0.012 : 0, horizontal ? 0 : (s * L) / 2 - s * 0.012, 0.012]}
          rotation-x={Math.PI / 2}
        >
          <cylinderGeometry args={[0.004, 0.004, 0.024, 8]} />
        </mesh>
      ))}
    </group>
  );
}

const faucetCurve = new THREE.CatmullRomCurve3([
  new THREE.Vector3(0, 0.02, 0),
  new THREE.Vector3(0, 0.24, 0),
  new THREE.Vector3(0, 0.32, 0.04),
  new THREE.Vector3(0, 0.31, 0.15),
  new THREE.Vector3(0, 0.25, 0.19),
]);
const faucetGeo = new THREE.TubeGeometry(faucetCurve, 32, 0.011, 10);

function SinkFixture({ it }: { it: Item }) {
  const metal = metalMat(it.p.metal);
  const steel = useMemo(() => new THREE.MeshStandardMaterial({ color: '#e4e6e7', roughness: 0.38, metalness: 0.55, side: THREE.BackSide }), []);
  const sw = sinkW(it);
  const sd = sinkD(it);
  const top = it.h + 0.03;
  const zFaucet = SINK_Z - sd / 2 - 0.05;
  return (
    <group>
      <mesh material={steel} position={[0, top - 0.1, SINK_Z]} receiveShadow>
        <boxGeometry args={[sw - 0.004, 0.2, sd - 0.004]} />
      </mesh>
      <mesh material={plainMat('#8e9092', 0.4, 0.8)} position={[0, top - 0.199, SINK_Z]} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[0.025, 20]} />
      </mesh>
      <group position={[0, top, zFaucet]}>
        <mesh material={metal} position-y={0.02} castShadow>
          <cylinderGeometry args={[0.026, 0.028, 0.04, 20]} />
        </mesh>
        <mesh geometry={faucetGeo} material={metal} castShadow />
        <mesh material={metal} position={[0.045, 0.1, 0]} rotation-z={-0.4} castShadow>
          <cylinderGeometry args={[0.007, 0.007, 0.09, 8]} />
        </mesh>
      </group>
    </group>
  );
}

function HobFixture({ it }: { it: Item }) {
  const w = Math.min(it.w - 0.1, 0.78);
  const d = Math.min(0.52, it.d - 0.06);
  return (
    <mesh material={hobMat()} position={[0, it.h + 0.03 + 0.003, 0]} receiveShadow>
      <boxGeometry args={[w, 0.006, d]} />
    </mesh>
  );
}

/** Free-standing worktop (islands); worktops against walls are built per run in Worktops. */
function IslandTop({ it }: { it: Item }) {
  const len = it.w + 0.004;
  const depth = it.d + 0.04;
  const sink = it.p.fixture === 'sink';
  const sw = sinkW(it);
  const sd = sinkD(it);
  const geo = useMemo(() => {
    const holes = sink ? [{ x: len / 2, y: depth / 2 + SINK_Z, w: sw, d: sd }] : [];
    const g = slabGeo(len, depth, 0.03, holes);
    g.translate(-len / 2, 0, -depth / 2);
    return g;
  }, [len, depth, sink, sw, sd]);
  useEffect(() => () => geo.dispose(), [geo]);
  return <mesh geometry={geo} material={topMat(it.p.top)} position-y={it.h} castShadow receiveShadow />;
}

function OvenFront({ x, y0, y1, w, z }: { x: number; y0: number; y1: number; w: number; z: number }) {
  const h = y1 - y0;
  const glass = plainMat('#141416', 0.12, 0.2);
  const steel = metalMat('steel');
  return (
    <group position={[x, y0 + h / 2, z]}>
      <Box w={w} h={h} d={T} mat={glass} />
      <Box w={w} h={0.08} d={T + 0.002} y={h / 2 - 0.04} mat={steel} />
      <Box w={w * 0.55} h={h * 0.42} d={0.002} y={-0.04} z={T / 2 + 0.001} mat={plainMat('#262628', 0.05, 0.4)} shadow={false} />
      <mesh material={steel} position={[0, h / 2 - 0.13, T / 2 + 0.03]} rotation-z={Math.PI / 2} castShadow>
        <cylinderGeometry args={[0.009, 0.009, w * 0.8, 12]} />
      </mesh>
    </group>
  );
}

/** Base, wall and tall cabinets and wardrobes, built from boxes so every size works. */
export function CabinetModel({ it }: { it: Item }) {
  const p = it.p;
  const kind = it.type;
  const mat = finishMat(p.finish, p.color, false);
  const doorMat = finishMat(p.finish, p.color, p.style === 'fluted');
  const metal = metalMat(p.metal);
  const plinth = kind === 'base' || kind === 'tall' ? 0.1 : kind === 'wardrobe' ? 0.08 : 0;
  const y0 = kind === 'wall' ? it.elev : 0;
  const yb = y0 + plinth;
  const yt = y0 + it.h;
  const hc = yt - yb;
  const zDoor = it.d / 2 - T / 2;
  const sink = kind === 'base' && p.fixture === 'sink';
  const oven = kind === 'tall' && p.appliance === 'oven';

  const fronts: Front[] = [];
  const n = Math.max(1, p.doors ?? 1);
  let ovenSlot: [number, number] | null = null;
  if (kind === 'base' && p.layout === 'drawers' && !sink) {
    const cols = it.w > 1.0 ? 2 : 1;
    const ratios = hc < 0.55 ? [0.5, 0.5] : [0.24, 0.33, 0.43];
    const cw = (it.w - GAP * (cols + 1)) / cols;
    for (let c = 0; c < cols; c++) {
      const cx = -it.w / 2 + GAP + cw / 2 + c * (cw + GAP);
      let y = yt - GAP;
      for (const r of ratios) {
        const dh = hc * r - GAP;
        fronts.push({ x: cx, y: y - dh / 2, w: cw, h: dh, orient: 'h', hx: cx, hy: y - Math.min(0.045, dh * 0.3), hlen: Math.min(0.42, cw * 0.5) });
        y -= dh + GAP;
      }
    }
  } else if (oven) {
    // door below, built-in oven in the middle, door above
    const o0 = Math.max(yb + 0.35, 0.82);
    const o1 = Math.min(o0 + 0.6, yt - 0.3);
    ovenSlot = [o0 + GAP, o1 - GAP];
    const dw = it.w - GAP * 2;
    const lowH = o0 - yb - GAP;
    const upH = yt - o1 - GAP;
    fronts.push({ x: 0, y: yb + lowH / 2, w: dw, h: lowH, orient: 'h', hx: 0, hy: o0 - 0.06, hlen: Math.min(0.32, dw * 0.55) });
    fronts.push({ x: 0, y: yt - GAP - upH / 2, w: dw, h: upH, orient: 'h', hx: 0, hy: o1 + 0.06, hlen: Math.min(0.32, dw * 0.55) });
  } else {
    const rows = kind === 'tall' && hc > 1.6 ? [0.4, 0.6] : [1];
    const dw = (it.w - GAP * (n + 1)) / n;
    let y = yt - GAP;
    rows.forEach((r, ri) => {
      const dh = hc * r - GAP * (rows.length === 1 ? 2 : 1.5);
      for (let i = 0; i < n; i++) {
        const cx = -it.w / 2 + GAP + dw / 2 + i * (dw + GAP);
        const paired = i < n - (n % 2);
        const edge = paired ? (i % 2 === 0 ? 1 : -1) : -1;
        let f: Front;
        if (kind === 'base') f = { x: cx, y: y - dh / 2, w: dw, h: dh, orient: 'h', hx: cx, hy: y - 0.05, hlen: Math.max(0.1, Math.min(0.32, dw * 0.55)) };
        else if (kind === 'wall') f = { x: cx, y: y - dh / 2, w: dw, h: dh, orient: 'h', hx: cx, hy: y - dh + 0.05, hlen: Math.max(0.1, Math.min(0.32, dw * 0.55)) };
        else {
          const hy = rows.length > 1 ? (ri === 0 ? y - dh + 0.22 : y - 0.22) : Math.min(1.05, y - 0.3);
          f = { x: cx, y: y - dh / 2, w: dw, h: dh, orient: 'v', hx: cx + edge * (dw / 2 - 0.045), hy, hlen: kind === 'wardrobe' ? 0.45 : 0.3 };
        }
        fronts.push(f);
      }
      y -= dh + GAP;
    });
  }

  return (
    <group>
      {sink ? (
        <group>
          {/* open-topped carcass so the basin can drop into it */}
          <Box w={it.w} h={Math.max(0.05, hc - 0.26)} d={it.d - T} y={yb + Math.max(0.05, hc - 0.26) / 2} z={-T / 2} mat={mat} />
          <Box w={0.018} h={hc} d={it.d - T} x={-it.w / 2 + 0.009} y={yb + hc / 2} z={-T / 2} mat={mat} />
          <Box w={0.018} h={hc} d={it.d - T} x={it.w / 2 - 0.009} y={yb + hc / 2} z={-T / 2} mat={mat} />
          <Box w={it.w} h={hc} d={0.018} y={yb + hc / 2} z={-it.d / 2 + 0.009} mat={mat} />
        </group>
      ) : (
        <Box w={it.w} h={hc} d={it.d - T} y={yb + hc / 2} z={-T / 2} mat={mat} />
      )}
      {plinth > 0 && <Box w={it.w - 0.004} h={plinth} d={it.d - T - 0.06} y={plinth / 2} z={-(T + 0.06) / 2} mat={mat} />}
      {fronts.map((f, i) => (
        <group key={i}>
          <DoorPanel f={f} z={zDoor} style={p.style} mat={doorMat} />
          <Handle f={f} z={zDoor} kind={p.handle} mat={metal} />
        </group>
      ))}
      {ovenSlot && <OvenFront x={0} y0={ovenSlot[0]} y1={ovenSlot[1]} w={it.w - GAP * 2} z={zDoor} />}
      {kind === 'base' && p.top && p.top !== 'none' && it.wall === null && <IslandTop it={it} />}
      {sink && <SinkFixture it={it} />}
      {kind === 'base' && p.fixture === 'hob' && <HobFixture it={it} />}
      {kind === 'wall' && p.led && <Box w={it.w - 0.04} h={0.006} d={0.016} y={it.elev - 0.003} z={it.d / 2 - 0.05} mat={glowMat(kelvin(3000), 3)} shadow={false} />}
    </group>
  );
}

function domeProfile(r: number) {
  const pts: THREE.Vector2[] = [];
  for (let k = 0; k <= 24; k++) {
    const s = (k / 24) * (Math.PI / 2);
    pts.push(new THREE.Vector2(0.022 + (r - 0.022) * Math.sin(s), -r * 0.62 * (1 - Math.cos(s))));
  }
  return pts;
}

export function PendantModel({ it, wallH }: { it: Item; wallH: number }) {
  const p = it.p;
  const r = it.w / 2;
  const on = p.on !== false;
  const col = useMemo(() => kelvin(p.temp ?? 2700), [p.temp]);
  const metal = metalMat(p.metal);
  const top = wallH - it.h; // top of the shade
  const sh = shadeHeight(it);
  const dome = useMemo(() => new THREE.LatheGeometry(domeProfile(r), 48), [r]);
  const bulbY = p.shade === 'globe' ? top - r : top - sh * 0.55;
  return (
    <group>
      <mesh material={metal} position={[0, wallH - 0.012, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 0.024, 24]} />
      </mesh>
      <mesh material={plainMat('#1b1b1b', 0.6)} position={[0, wallH - it.h / 2, 0]}>
        <cylinderGeometry args={[0.003, 0.003, it.h, 6]} />
      </mesh>
      {p.shade === 'globe' && (
        <mesh position={[0, top - r, 0]} castShadow>
          <sphereGeometry args={[r, 40, 28]} />
          <meshStandardMaterial color="#ffffff" emissive={col} emissiveIntensity={on ? 1.4 : 0} roughness={0.35} transparent opacity={0.96} />
        </mesh>
      )}
      {p.shade === 'cylinder' && (
        <group position={[0, top - sh / 2, 0]}>
          <mesh material={metal} castShadow>
            <cylinderGeometry args={[r * 0.72, r * 0.72, sh, 40, 1, true]} />
          </mesh>
          <mesh scale={0.985}>
            <cylinderGeometry args={[r * 0.72, r * 0.72, sh, 40, 1, true]} />
            <meshStandardMaterial color="#f4f1ea" side={THREE.BackSide} emissive={col} emissiveIntensity={on ? 0.5 : 0} />
          </mesh>
        </group>
      )}
      {(p.shade === 'dome' || !p.shade) && (
        <group position={[0, top, 0]}>
          {/* the lathe profile winds so its front faces point inwards */}
          <mesh geometry={dome} castShadow>
            <meshStandardMaterial color={metalColor(p.metal)} roughness={0.4} metalness={0.6} side={THREE.BackSide} />
          </mesh>
          <mesh geometry={dome} scale={0.985}>
            <meshStandardMaterial color="#f4f1ea" side={THREE.FrontSide} emissive={col} emissiveIntensity={on ? 0.5 : 0} />
          </mesh>
        </group>
      )}
      {p.shade !== 'globe' && (
        <mesh position={[0, bulbY, 0]}>
          <sphereGeometry args={[0.03, 16, 12]} />
          <meshStandardMaterial color="#ffffff" emissive={col} emissiveIntensity={on ? 6 : 0} />
        </mesh>
      )}
      <pointLight position={[0, bulbY - 0.06, 0]} color={col} intensity={on ? 4.5 : 0} decay={2} distance={0} />
    </group>
  );
}

function metalColor(id: string | undefined) {
  return id === 'brass' ? '#c9a35a' : id === 'steel' ? '#c9c9c7' : '#232323';
}

export function CeilingLightModel({ it, wallH }: { it: Item; wallH: number }) {
  const on = it.p.on !== false;
  const col = useMemo(() => kelvin(it.p.temp ?? 4000), [it.p.temp]);
  return (
    <group>
      <mesh position={[0, wallH - it.h / 2, 0]}>
        <cylinderGeometry args={[it.w / 2, it.w / 2 - 0.01, it.h, 48]} />
        <meshStandardMaterial color="#ffffff" emissive={col} emissiveIntensity={on ? 1.6 : 0} roughness={0.4} />
      </mesh>
      <pointLight position={[0, wallH - 0.3, 0]} color={col} intensity={on ? 8 : 0} decay={2} distance={0} />
    </group>
  );
}

function curtainGeo(width: number, height: number, folds: number, amp: number) {
  const seg = Math.max(32, Math.round(folds * 10));
  const g = new THREE.PlaneGeometry(width, height, seg, 1);
  const pos = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const u = (pos.getX(i) + width / 2) / width;
    pos.setZ(i, Math.sin(u * folds * Math.PI * 2) * amp);
  }
  g.computeVertexNormals();
  return g;
}

export function CurtainModel({ it, wallH }: { it: Item; wallH: number }) {
  const p = it.p;
  const rodY = wallH - CURTAIN_ROD_DROP;
  const h = Math.min(it.h, rodY - 0.01);
  const open = p.open ?? 0.3;
  const half = it.w / 2 + 0.04;
  const pw = Math.max(0.14, half * (1 - open * 0.82));
  const folds = Math.max(4, Math.round(half / 0.11));
  const amp = 0.022 + 0.045 * open;
  const geo = useMemo(() => curtainGeo(pw, h, folds, amp), [pw, h, folds, amp]);
  const zRod = -it.d / 2 + 0.08;
  const fabric = fabricMat(p.fabric, !!p.sheer);
  const metal = metalMat(p.metal);
  return (
    <group>
      <mesh material={metal} position={[0, rodY + 0.015, zRod]} rotation-z={Math.PI / 2} castShadow>
        <cylinderGeometry args={[0.011, 0.011, it.w + 0.16, 12]} />
      </mesh>
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh material={metal} position={[s * (it.w / 2 + 0.085), rodY + 0.015, zRod]}>
            <sphereGeometry args={[0.02, 14, 10]} />
          </mesh>
          <mesh material={metal} position={[s * (it.w / 2 + 0.03), rodY + 0.015, -it.d / 2 + 0.04]} rotation-x={Math.PI / 2}>
            <cylinderGeometry args={[0.006, 0.006, 0.08, 8]} />
          </mesh>
          <mesh geometry={geo} material={fabric} position={[s * (half - pw / 2), rodY - h / 2, zRod]} castShadow={!p.sheer} receiveShadow />
        </group>
      ))}
    </group>
  );
}

export function ItemModel({ it, wallH, night }: { it: Item; wallH: number; night: boolean }) {
  switch (it.type) {
    case 'pendant':
      return <PendantModel it={it} wallH={wallH} />;
    case 'ceiling':
      return <CeilingLightModel it={it} wallH={wallH} />;
    case 'curtain':
      return <CurtainModel it={it} wallH={wallH} />;
    case 'window':
      return <WindowModel it={it} night={night} />;
    case 'door':
      return <DoorModel it={it} />;
    case 'fridge':
      return <FridgeModel it={it} />;
    case 'hood':
      return <HoodModel it={it} wallH={wallH} />;
    case 'bed':
      return <BedModel it={it} night={night} />;
    case 'sofa':
      return <SofaModel it={it} />;
    case 'dining':
      return <DiningModel it={it} />;
    case 'rug':
      return <RugModel it={it} />;
    case 'plant':
      return <PlantModel it={it} />;
    case 'tv':
      return <TVModel it={it} />;
    case 'model':
      return <ImportedModel it={it} />;
    default:
      return <CabinetModel it={it} />;
  }
}
