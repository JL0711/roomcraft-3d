import { RoundedBox } from '@react-three/drei';
import { useMemo } from 'react';
import * as THREE from 'three';
import { CHAIR_REACH, NIGHTSTAND_W } from '../catalog';
import { boxGeo, WALL_T } from '../geometry';
import {
  finishMat,
  kelvin,
  metalMat,
  plainMat,
  rugMat,
  screenMat,
  skyMat,
  upholsteryMat,
  glassMat,
} from '../materials';
import type { Item } from '../types';

function Box(props: { w: number; h: number; d: number; x?: number; y?: number; z?: number; mat: THREE.Material; shadow?: boolean }) {
  const { w, h, d, x = 0, y = 0, z = 0, mat, shadow = true } = props;
  return <mesh geometry={boxGeo(w, h, d)} material={mat} position={[x, y, z]} castShadow={shadow} receiveShadow />;
}

function Leg({ x, z, h, r = 0.014, mat }: { x: number; z: number; h: number; r?: number; mat: THREE.Material }) {
  return (
    <mesh material={mat} position={[x, h / 2, z]} castShadow>
      <cylinderGeometry args={[r, r * 0.8, h, 10]} />
    </mesh>
  );
}

const hash = (s: string) => {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
};
const rng = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};

/** French-door fridge with a freezer drawer. */
export function FridgeModel({ it }: { it: Item }) {
  const m = metalMat(it.p.metal ?? 'steel');
  const dark = plainMat('#1b1b1c', 0.6);
  const t = 0.045;
  const split = it.h * 0.62;
  const zf = it.d / 2 - t / 2;
  return (
    <group>
      <Box w={it.w} h={it.h - 0.06} d={it.d - t} y={0.06 + (it.h - 0.06) / 2} z={-t / 2} mat={m} />
      <Box w={it.w - 0.02} h={0.06} d={0.02} y={0.03} z={it.d / 2 - 0.05} mat={dark} />
      {[-1, 1].map((s) => (
        <group key={s}>
          <Box w={it.w / 2 - 0.004} h={it.h - split - 0.004} d={t} x={(s * it.w) / 4} y={split + (it.h - split) / 2} z={zf} mat={m} />
          <mesh material={m} position={[s * 0.035, split + (it.h - split) * 0.45, it.d / 2 + 0.035]} castShadow>
            <cylinderGeometry args={[0.012, 0.012, (it.h - split) * 0.6, 12]} />
          </mesh>
        </group>
      ))}
      <Box w={it.w - 0.004} h={split - 0.07} d={t} y={0.065 + (split - 0.065) / 2} z={zf} mat={m} />
      <mesh material={m} position={[0, split - 0.08, it.d / 2 + 0.035]} rotation-z={Math.PI / 2} castShadow>
        <cylinderGeometry args={[0.012, 0.012, it.w * 0.7, 12]} />
      </mesh>
    </group>
  );
}

/** Chimney range hood: canopy, sloped transition and a duct cover up to the ceiling. */
export function HoodModel({ it, wallH }: { it: Item; wallH: number }) {
  const m = metalMat(it.p.metal ?? 'steel');
  const cw = Math.min(0.32, it.w * 0.4);
  const cd = Math.min(0.26, it.d * 0.55);
  const slopeH = it.h - 0.06;
  const geo = useMemo(() => {
    const g = new THREE.BoxGeometry(1, 1, 1);
    const pos = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const top = pos.getY(i) > 0;
      const x = pos.getX(i);
      const z = pos.getZ(i);
      pos.setXYZ(
        i,
        x * (top ? cw : it.w),
        top ? slopeH : 0,
        top ? -it.d / 2 + (z + 0.5) * cd : z * it.d,
      );
    }
    g.computeVertexNormals();
    return g;
  }, [it.w, it.d, cw, cd, slopeH]);
  const y1 = it.elev + it.h;
  return (
    <group>
      <Box w={it.w} h={0.06} d={it.d} y={it.elev + 0.03} mat={m} />
      <Box w={it.w - 0.04} h={0.004} d={it.d - 0.04} y={it.elev - 0.002} mat={plainMat('#3a3a3c', 0.5, 0.6)} shadow={false} />
      <mesh geometry={geo} material={m} position-y={it.elev + 0.06} castShadow />
      <Box w={cw} h={Math.max(0.01, wallH - y1)} d={cd} y={(y1 + wallH) / 2} z={-it.d / 2 + cd / 2} mat={m} />
    </group>
  );
}

function Lamp({ x, z, on }: { x: number; z: number; on: boolean }) {
  const col = useMemo(() => kelvin(2700), []);
  return (
    <group position={[x, 0.5, z]}>
      <mesh material={plainMat('#d9d2c6', 0.45)} position-y={0.12} castShadow>
        <cylinderGeometry args={[0.05, 0.07, 0.24, 20]} />
      </mesh>
      <mesh position-y={0.32} castShadow>
        <cylinderGeometry args={[0.1, 0.14, 0.2, 28, 1, true]} />
        <meshStandardMaterial color="#f1ebe0" emissive={col} emissiveIntensity={on ? 0.7 : 0} side={THREE.DoubleSide} roughness={0.9} />
      </mesh>
      <pointLight position={[0, 0.3, 0]} color={col} intensity={on ? 0.9 : 0} decay={2} distance={0} />
    </group>
  );
}

export function BedModel({ it, night }: { it: Item; night: boolean }) {
  const p = it.p;
  const w = it.w;
  const d = it.d;
  const wood = finishMat(p.finish ?? 'oak', undefined, false);
  const fab = upholsteryMat(p.fabric);
  const head = upholsteryMat(p.fabric, true);
  const sheet = plainMat('#f5f3ee', 0.95);
  const duvet = upholsteryMat('linen');
  const legH = 0.08;
  const frameTop = legH + 0.28;
  const matTop = frameTop + 0.2;
  const duvetLen = (d - 0.25) * 0.68;
  const zFront = d / 2 - 0.02;
  return (
    <group>
      {[
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ].map(([sx, sz], i) => (
        <Leg key={i} x={sx * (w / 2 - 0.06)} z={sz * (d / 2 - 0.1) + 0.04} h={legH} r={0.025} mat={wood} />
      ))}
      <RoundedBox args={[w, 0.28, d - 0.08]} radius={0.03} smoothness={3} position={[0, legH + 0.14, 0.04]} material={fab} castShadow receiveShadow />
      <RoundedBox args={[w + 0.08, it.h - 0.05, 0.09]} radius={0.035} smoothness={3} position={[0, 0.05 + (it.h - 0.05) / 2, -d / 2 + 0.045]} material={head} castShadow receiveShadow />
      <RoundedBox args={[w - 0.08, 0.2, d - 0.2]} radius={0.06} smoothness={3} position={[0, frameTop + 0.1, 0.06]} material={sheet} castShadow receiveShadow />
      <RoundedBox args={[w + 0.02, 0.06, duvetLen]} radius={0.03} smoothness={3} position={[0, matTop + 0.02, zFront - duvetLen / 2]} material={duvet} castShadow receiveShadow />
      {[-1, 1].map((s) => (
        <RoundedBox key={s} args={[0.035, 0.26, duvetLen]} radius={0.015} smoothness={2} position={[s * (w / 2 + 0.01), matTop - 0.1, zFront - duvetLen / 2]} material={duvet} castShadow />
      ))}
      <RoundedBox args={[w + 0.02, 0.26, 0.035]} radius={0.015} smoothness={2} position={[0, matTop - 0.1, zFront + 0.005]} material={duvet} castShadow />
      {[-1, 1].map((s) => (
        <RoundedBox
          key={`p${s}`}
          args={[w * 0.4, 0.13, 0.4]}
          radius={0.06}
          smoothness={3}
          position={[s * w * 0.22, matTop + 0.07, -d / 2 + 0.36]}
          rotation-x={-0.35}
          material={sheet}
          castShadow
        />
      ))}
      {p.nightstands &&
        [-1, 1].map((s) => {
          const x = s * (w / 2 + 0.04 + NIGHTSTAND_W / 2);
          const z = -d / 2 + 0.21;
          return (
            <group key={`n${s}`}>
              <Box w={NIGHTSTAND_W} h={0.5} d={0.4} x={x} y={0.25} z={z} mat={wood} />
              <Box w={NIGHTSTAND_W - 0.04} h={0.003} d={0.004} x={x} y={0.33} z={z + 0.201} mat={plainMat('#3b3530', 0.8)} shadow={false} />
              <Lamp x={x} z={z} on={night} />
            </group>
          );
        })}
    </group>
  );
}

export function SofaModel({ it }: { it: Item }) {
  const p = it.p;
  const w = it.w;
  const d = it.d;
  const fab = upholsteryMat(p.fabric);
  const legs = metalMat(p.metal ?? 'black');
  const accent = upholsteryMat(p.fabric === 'navy' ? 'linen' : 'blush');
  const legH = 0.1;
  const armW = 0.17;
  const n = w >= 1.9 ? 3 : 2;
  const inner = w - armW * 2;
  const cw = (inner - 0.01 * (n - 1)) / n;
  const seatY = legH + 0.22;
  return (
    <group>
      {[
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ].map(([sx, sz], i) => (
        <Leg key={i} x={sx * (w / 2 - 0.08)} z={sz * (d / 2 - 0.08)} h={legH} mat={legs} />
      ))}
      <RoundedBox args={[w, 0.22, d]} radius={0.03} smoothness={3} position={[0, legH + 0.11, 0]} material={fab} castShadow receiveShadow />
      <RoundedBox args={[w, it.h - legH, 0.2]} radius={0.05} smoothness={3} position={[0, legH + (it.h - legH) / 2, -d / 2 + 0.1]} material={fab} castShadow receiveShadow />
      {[-1, 1].map((s) => (
        <RoundedBox key={s} args={[armW, 0.62 - legH, d]} radius={0.05} smoothness={3} position={[s * (w / 2 - armW / 2), legH + (0.62 - legH) / 2, 0]} material={fab} castShadow receiveShadow />
      ))}
      {Array.from({ length: n }, (_, i) => {
        const x = -inner / 2 + cw / 2 + i * (cw + 0.01);
        return (
          <group key={i}>
            <RoundedBox args={[cw, 0.15, d - 0.26]} radius={0.05} smoothness={3} position={[x, seatY + 0.075, 0.1]} material={fab} castShadow receiveShadow />
            <RoundedBox args={[cw, Math.min(0.44, it.h - seatY - 0.02), 0.18]} radius={0.06} smoothness={3} position={[x, seatY + 0.15 + 0.2, -d / 2 + 0.29]} rotation-x={-0.12} material={fab} castShadow receiveShadow />
          </group>
        );
      })}
      {[-1, 1].map((s) => (
        <RoundedBox
          key={`c${s}`}
          args={[0.42, 0.4, 0.13]}
          radius={0.06}
          smoothness={3}
          position={[s * (inner / 2 - 0.25), seatY + 0.36, -d / 2 + 0.43]}
          rotation={[-0.2, s * 0.25, s * 0.08]}
          material={accent}
          castShadow
        />
      ))}
    </group>
  );
}

function Chair({ x, z, rot, seat, frame }: { x: number; z: number; rot: number; seat: THREE.Material; frame: THREE.Material }) {
  return (
    <group position={[x, 0, z]} rotation-y={rot}>
      {[
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ].map(([sx, sz], i) => (
        <Leg key={i} x={sx * 0.19} z={sz * 0.19} h={0.44} r={0.012} mat={frame} />
      ))}
      <RoundedBox args={[0.45, 0.06, 0.45]} radius={0.02} smoothness={2} position={[0, 0.47, 0]} material={seat} castShadow receiveShadow />
      <RoundedBox args={[0.43, 0.3, 0.04]} radius={0.015} smoothness={2} position={[0, 0.72, -0.2]} rotation-x={-0.1} material={seat} castShadow />
      {[-1, 1].map((s) => (
        <mesh key={s} material={frame} position={[s * 0.19, 0.62, -0.2]} castShadow>
          <cylinderGeometry args={[0.011, 0.011, 0.32, 8]} />
        </mesh>
      ))}
    </group>
  );
}

export function DiningModel({ it }: { it: Item }) {
  const p = it.p;
  const wood = finishMat(p.finish ?? 'oak', undefined, false);
  const seat = upholsteryMat(p.fabric);
  const frame = metalMat(p.metal ?? 'black');
  const n = Math.max(2, p.chairs ?? 6);
  const perSide = Math.ceil(n / 2);
  const chairs: { x: number; z: number; rot: number }[] = [];
  for (let side = 0; side < 2; side++) {
    const count = side === 0 ? perSide : n - perSide;
    for (let i = 0; i < count; i++) {
      const x = -it.w / 2 + (it.w * (i + 0.5)) / count;
      const z = (side === 0 ? 1 : -1) * (it.d / 2 + CHAIR_REACH - 0.33);
      chairs.push({ x, z, rot: side === 0 ? Math.PI : 0 });
    }
  }
  return (
    <group>
      <RoundedBox args={[it.w, 0.04, it.d]} radius={0.012} smoothness={2} position={[0, it.h - 0.02, 0]} material={wood} castShadow receiveShadow />
      {[
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ].map(([sx, sz], i) => (
        <Box key={i} w={0.06} h={it.h - 0.04} d={0.06} x={sx * (it.w / 2 - 0.09)} y={(it.h - 0.04) / 2} z={sz * (it.d / 2 - 0.09)} mat={wood} />
      ))}
      {chairs.map((c, i) => (
        <Chair key={i} {...c} seat={seat} frame={frame} />
      ))}
    </group>
  );
}

export function RugModel({ it }: { it: Item }) {
  const mats = useMemo(() => {
    const top = rugMat(it.p.fabric);
    const edge = plainMat('#cfc8bc', 1);
    return [edge, edge, top, edge, edge, edge];
  }, [it.p.fabric]);
  return (
    <mesh material={mats} position-y={0.006} receiveShadow>
      <boxGeometry args={[it.w, 0.012, it.d]} />
    </mesh>
  );
}

function leafGeometry() {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(0.5, 0.25, 0.45, 0.75, 0, 1);
  s.bezierCurveTo(-0.45, 0.75, -0.5, 0.25, 0, 0);
  const g = new THREE.ShapeGeometry(s, 10);
  // a gentle fold along the midrib
  const pos = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.abs(pos.getX(i)) * 0.35 - pos.getY(i) * pos.getY(i) * 0.15);
  g.computeVertexNormals();
  return g;
}
let leafGeo: THREE.ShapeGeometry | null = null;

export function PlantModel({ it }: { it: Item }) {
  const potH = Math.min(0.42, it.h * 0.32);
  const potR = it.w * 0.3;
  const leaves = useMemo(() => {
    leafGeo ??= leafGeometry();
    const r = rng(hash(it.id));
    const up = new THREE.Vector3(0, 1, 0);
    const out: { pos: THREE.Vector3; rot: THREE.Euler; stem: THREE.Quaternion; len: number; s: number; c: string }[] = [];
    const n = 16;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + r() * 0.5;
      const rise = (it.h - potH) * (0.3 + r() * 0.5);
      const rad = potR * 0.3 + r() * it.w * 0.22;
      const pos = new THREE.Vector3(Math.cos(a) * rad, rise, Math.sin(a) * rad);
      out.push({
        pos,
        // tilt the leaf outwards (about X), then turn it to face direction a (about Y)
        rot: new THREE.Euler(-(0.45 + r() * 0.75), -a - Math.PI / 2, 0, 'YXZ'),
        stem: new THREE.Quaternion().setFromUnitVectors(up, pos.clone().normalize()),
        len: pos.length(),
        s: (it.h - potH) * (0.3 + r() * 0.18),
        c: r() < 0.5 ? '#3f6d3a' : '#4f8247',
      });
    }
    return out;
  }, [it.id, it.h, it.w, potH, potR]);
  return (
    <group>
      <mesh material={plainMat('#e8e3da', 0.55)} position-y={potH / 2} castShadow receiveShadow>
        <cylinderGeometry args={[potR, potR * 0.78, potH, 32]} />
      </mesh>
      <mesh material={plainMat('#3b2e25', 1)} position-y={potH - 0.02}>
        <cylinderGeometry args={[potR * 0.95, potR * 0.95, 0.02, 24]} />
      </mesh>
      {leaves.map((l, i) => (
        <group key={i} position={[0, potH - 0.02, 0]}>
          <mesh material={plainMat('#55703f', 0.8)} position={l.pos.clone().multiplyScalar(0.5)} quaternion={l.stem}>
            <cylinderGeometry args={[0.005, 0.008, l.len, 5]} />
          </mesh>
          <mesh geometry={leafGeo!} position={l.pos} rotation={l.rot} scale={l.s} castShadow>
            <meshStandardMaterial color={l.c} side={THREE.DoubleSide} roughness={0.6} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

export function TVModel({ it }: { it: Item }) {
  const z = -it.d / 2 + 0.035;
  return (
    <group>
      <Box w={it.w} h={it.h} d={0.03} y={it.elev + it.h / 2} z={z} mat={plainMat('#111112', 0.4, 0.3)} />
      <mesh material={screenMat(it.p.on !== false)} position={[0, it.elev + it.h / 2, z + 0.0155]}>
        <planeGeometry args={[it.w - 0.016, it.h - 0.016]} />
      </mesh>
    </group>
  );
}

/** Door set inside the wall opening: lining, room-side architrave and a hinged leaf. */
export function DoorModel({ it }: { it: Item }) {
  const p = it.p;
  const T = WALL_T;
  const lining = plainMat('#f2f0eb', 0.6);
  const leafMat = finishMat(p.finish ?? 'lac-white', p.color, false);
  const metal = metalMat(p.metal ?? 'black');
  const leafW = it.w - 0.04;
  const leafH = it.h - 0.02;
  const angle = -(p.open ?? 0) * 1.45;
  const fr = 0.07;
  return (
    <group>
      <Box w={0.02} h={it.h} d={T} x={-it.w / 2 + 0.01} y={it.h / 2} mat={lining} />
      <Box w={0.02} h={it.h} d={T} x={it.w / 2 - 0.01} y={it.h / 2} mat={lining} />
      <Box w={it.w} h={0.02} d={T} y={it.h - 0.01} mat={lining} />
      {[-1, 1].map((s) => (
        <Box key={s} w={fr} h={it.h + fr} d={0.015} x={s * (it.w / 2 + fr / 2)} y={(it.h + fr) / 2} z={T / 2 + 0.0075} mat={lining} />
      ))}
      <Box w={it.w + fr * 2} h={fr} d={0.015} y={it.h + fr / 2} z={T / 2 + 0.0075} mat={lining} />
      <group position={[-it.w / 2 + 0.02, 0, T / 2 - 0.02]} rotation-y={angle}>
        <group position={[leafW / 2, leafH / 2 + 0.01, -0.02]}>
          <Box w={leafW} h={leafH} d={0.04} mat={leafMat} />
          {p.style === 'shaker' &&
            [0.28, -0.22].map((fy, i) => (
              <Box key={i} w={leafW - 0.24} h={leafH * (i ? 0.42 : 0.3)} d={0.006} y={leafH * fy} z={0.021} mat={leafMat} />
            ))}
          <group position={[leafW / 2 - 0.07, 1.02 - (leafH / 2 + 0.01), 0.02]}>
            <mesh material={metal} position-z={0.012} rotation-x={Math.PI / 2}>
              <cylinderGeometry args={[0.025, 0.025, 0.01, 20]} />
            </mesh>
            <mesh material={metal} position={[-0.05, 0, 0.05]} rotation-z={Math.PI / 2} castShadow>
              <cylinderGeometry args={[0.009, 0.009, 0.12, 12]} />
            </mesh>
            <mesh material={metal} position={[0, 0, 0.03]} rotation-x={Math.PI / 2}>
              <cylinderGeometry args={[0.008, 0.008, 0.045, 10]} />
            </mesh>
          </group>
        </group>
      </group>
    </group>
  );
}

/** Window set inside the wall opening, with a view backdrop outside it. */
export function WindowModel({ it, night }: { it: Item; night: boolean }) {
  const T = WALL_T;
  const fw = 0.05;
  const frame = metalMat(it.p.metal);
  const lining = plainMat('#f2f0eb', 0.6);
  const cy = it.elev + it.h / 2;
  const mullion = it.w > 1.2;
  return (
    <group>
      {/* the view outside: close behind the opening and only a little larger, so it never shows over the wall top */}
      <mesh material={skyMat(night)} position={[0, cy, -T / 2 - 0.1]}>
        <planeGeometry args={[it.w + 0.3, it.h + 0.3]} />
      </mesh>
      <Box w={0.015} h={it.h} d={T} x={-it.w / 2 + 0.0075} y={cy} mat={lining} />
      <Box w={0.015} h={it.h} d={T} x={it.w / 2 - 0.0075} y={cy} mat={lining} />
      <Box w={it.w} h={0.015} d={T} y={it.elev + it.h - 0.0075} mat={lining} />
      <mesh material={glassMat()} position={[0, cy, 0]}>
        <planeGeometry args={[it.w - fw * 2, it.h - fw * 2]} />
      </mesh>
      <Box w={it.w - 0.03} h={fw} d={0.07} y={it.elev + it.h - 0.015 - fw / 2} mat={frame} />
      <Box w={it.w - 0.03} h={fw} d={0.07} y={it.elev + fw / 2} mat={frame} />
      <Box w={fw} h={it.h - 0.03} d={0.07} x={-it.w / 2 + 0.015 + fw / 2} y={cy} mat={frame} />
      <Box w={fw} h={it.h - 0.03} d={0.07} x={it.w / 2 - 0.015 - fw / 2} y={cy} mat={frame} />
      {mullion && <Box w={fw * 0.7} h={it.h - 0.03} d={0.06} y={cy} mat={frame} />}
      <Box w={it.w + 0.1} h={0.03} d={T / 2 + 0.08} y={it.elev - 0.015} z={T / 4 + 0.04} mat={plainMat('#e9e6e0', 0.45)} />
    </group>
  );
}
