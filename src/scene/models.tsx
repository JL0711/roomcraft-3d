import { useMemo } from 'react';
import * as THREE from 'three';
import { CURTAIN_ROD_DROP, shadeHeight } from '../catalog';
import { boxGeo } from '../geometry';
import {
  fabricMat,
  finishMat,
  glassMat,
  glowMat,
  kelvin,
  metalMat,
  plainMat,
  skyMat,
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

  const fronts: Front[] = [];
  const n = Math.max(1, p.doors ?? 1);
  if (kind === 'base' && p.layout === 'drawers') {
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
      <Box w={it.w} h={hc} d={it.d - T} y={yb + hc / 2} z={-T / 2} mat={mat} />
      {plinth > 0 && <Box w={it.w - 0.004} h={plinth} d={it.d - T - 0.06} y={plinth / 2} z={-(T + 0.06) / 2} mat={mat} />}
      {fronts.map((f, i) => (
        <group key={i}>
          <DoorPanel f={f} z={zDoor} style={p.style} mat={doorMat} />
          <Handle f={f} z={zDoor} kind={p.handle} mat={metal} />
        </group>
      ))}
      {kind === 'base' && p.top && p.top !== 'none' && (
        <Box w={it.w + 0.004} h={0.03} d={it.d + 0.02} y={it.h + 0.015} z={it.wall === null ? 0 : 0.01} mat={topMat(p.top)} />
      )}
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

export function WindowModel({ it, night }: { it: Item; night: boolean }) {
  const fw = 0.05;
  const zb = -it.d / 2;
  const frame = metalMat(it.p.metal);
  const cy = it.elev + it.h / 2;
  const mullion = it.w > 1.2;
  return (
    <group>
      <mesh material={skyMat(night)} position={[0, cy, zb + 0.004]}>
        <planeGeometry args={[it.w - fw * 2, it.h - fw * 2]} />
      </mesh>
      <mesh material={glassMat()} position={[0, cy, zb + 0.03]}>
        <planeGeometry args={[it.w - fw * 2, it.h - fw * 2]} />
      </mesh>
      <Box w={it.w} h={fw} d={it.d} y={it.elev + it.h - fw / 2} mat={frame} />
      <Box w={it.w} h={fw} d={it.d} y={it.elev + fw / 2} mat={frame} />
      <Box w={fw} h={it.h - fw * 2} d={it.d} x={-it.w / 2 + fw / 2} y={cy} mat={frame} />
      <Box w={fw} h={it.h - fw * 2} d={it.d} x={it.w / 2 - fw / 2} y={cy} mat={frame} />
      {mullion && <Box w={fw * 0.7} h={it.h - fw * 2} d={it.d * 0.8} y={cy} mat={frame} />}
      <Box w={it.w + 0.1} h={0.025} d={it.d + 0.1} y={it.elev - 0.0125} z={0.05} mat={plainMat('#e9e6e0', 0.5)} />
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
    default:
      return <CabinetModel it={it} />;
  }
}
