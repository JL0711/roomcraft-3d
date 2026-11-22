import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { bridge } from '../capture';
import { outerPoints, planeMetres, projectOnWall, signedArea, slabGeo, wallsOf, WALL_T, type Wall } from '../geometry';
import { floorMat, splashMat, topMat } from '../materials';
import { computeRuns } from '../runs';
import type { Design, Vec2 } from '../types';

interface Opening {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

/**
 * One wall as a vertical slab in its own frame: x along the wall (0..len),
 * y up, z from -T (outside) to 0 (the room-side face). Doors are notched
 * out of the bottom edge and windows are cut as holes.
 */
function wallSlab(len: number, H: number, ops: Opening[]) {
  const s = new THREE.Shape();
  const doors = ops.filter((o) => o.y0 < 0.02).sort((a, b) => a.x0 - b.x0);
  const windows = ops.filter((o) => o.y0 >= 0.02);
  s.moveTo(0, 0);
  let cursor = 0;
  for (const d of doors) {
    const x0 = Math.max(cursor + 0.02, d.x0);
    const x1 = Math.min(len - 0.02, d.x1);
    if (x1 - x0 < 0.1) continue;
    const top = Math.min(d.y1, H - 0.05);
    s.lineTo(x0, 0);
    s.lineTo(x0, top);
    s.lineTo(x1, top);
    s.lineTo(x1, 0);
    cursor = x1;
  }
  s.lineTo(len, 0);
  s.lineTo(len, H);
  s.lineTo(0, H);
  s.closePath();
  for (const w of windows) {
    const x0 = Math.max(0.03, w.x0);
    const x1 = Math.min(len - 0.03, w.x1);
    const y0 = w.y0;
    const y1 = Math.min(H - 0.03, w.y1);
    if (x1 - x0 < 0.1 || y1 - y0 < 0.1) continue;
    s.holes.push(new THREE.Path([new THREE.Vector2(x0, y0), new THREE.Vector2(x0, y1), new THREE.Vector2(x1, y1), new THREE.Vector2(x1, y0)]));
  }
  const g = new THREE.ExtrudeGeometry(s, { depth: WALL_T, bevelEnabled: false });
  g.translate(0, 0, -WALL_T);
  return g;
}

/** A top-view polygon extruded upwards (corner fillers) or a flat cap at height y. */
function prism(poly: Vec2[], h: number) {
  const g = new THREE.ExtrudeGeometry(new THREE.Shape(poly.map((p) => new THREE.Vector2(p.x, -p.z))), { depth: h, bevelEnabled: false });
  g.rotateX(-Math.PI / 2);
  return g;
}
function flat(poly: Vec2[], y: number) {
  const g = new THREE.ShapeGeometry(new THREE.Shape(poly.map((p) => new THREE.Vector2(p.x, -p.z))));
  g.rotateX(-Math.PI / 2);
  g.translate(0, y, 0);
  return g;
}

function frameOf(w: Wall, ccw: boolean) {
  const X = ccw ? w.dir : { x: -w.dir.x, z: -w.dir.z };
  const o = ccw ? w.a : w.b;
  return { origin: o, rot: Math.atan2(-X.z, X.x), xOf: (t: number) => (ccw ? t : w.len - t) };
}

export function Room({ design, inside }: { design: Design; inside: boolean }) {
  const { plan, wallH, wallColor } = design;
  const walls = useMemo(() => wallsOf(plan), [plan]);
  const ccw = signedArea(plan) > 0;
  const outer = useMemo(() => outerPoints(plan), [plan]);
  const n = plan.length;

  const openingKey = design.items
    .filter((it) => it.type === 'window' || it.type === 'door')
    .map((it) => `${it.wall}:${it.x.toFixed(3)}:${it.z.toFixed(3)}:${it.w}:${it.h}:${it.elev}`)
    .join('|');

  const slabs = useMemo(
    () =>
      walls.map((w) => {
        const f = frameOf(w, ccw);
        const ops: Opening[] = design.items
          .filter((it) => (it.type === 'window' || it.type === 'door') && it.wall === w.i)
          .map((it) => {
            const xc = f.xOf(projectOnWall(it, w).t);
            return { x0: xc - it.w / 2, x1: xc + it.w / 2, y0: it.type === 'door' ? 0 : it.elev, y1: it.elev + it.h };
          });
        return { geo: wallSlab(w.len, wallH, ops), ...f };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [walls, wallH, ccw, openingKey],
  );

  // fill the outside of convex corners so the wall band closes like a mitre
  const fillers = useMemo(
    () =>
      plan.map((v, i) => {
        const w0 = walls[(i - 1 + n) % n];
        const w1 = walls[i];
        const cross = w0.dir.x * w1.dir.z - w0.dir.z * w1.dir.x;
        const convex = ccw ? cross > 1e-6 : cross < -1e-6;
        if (!convex) return null;
        const poly = [v, { x: v.x - w0.nIn.x * WALL_T, z: v.z - w0.nIn.z * WALL_T }, outer[i], { x: v.x - w1.nIn.x * WALL_T, z: v.z - w1.nIn.z * WALL_T }];
        // keep the polygon wound consistently
        return prism(signedArea(poly) > 0 ? poly : poly.slice().reverse(), wallH);
      }),
    [plan, walls, outer, ccw, wallH, n],
  );

  const caps = useMemo(
    () => walls.map((w, i) => flat([plan[i], plan[(i + 1) % n], outer[(i + 1) % n], outer[i]], wallH + 0.001)),
    [walls, plan, outer, wallH, n],
  );

  const floorGeo = useMemo(() => {
    const g = new THREE.ShapeGeometry(new THREE.Shape(plan.map((p) => new THREE.Vector2(p.x, -p.z))));
    g.rotateX(-Math.PI / 2);
    return g;
  }, [plan]);

  const ceilGeo = useMemo(() => {
    const g = new THREE.ShapeGeometry(new THREE.Shape(plan.map((p) => new THREE.Vector2(p.x, p.z))));
    g.rotateX(Math.PI / 2);
    g.translate(0, wallH, 0);
    return g;
  }, [plan, wallH]);

  const mats = useMemo(
    () =>
      walls.map(() => ({
        cap: new THREE.MeshStandardMaterial({ color: '#57534e', roughness: 0.9, transparent: true }),
        side: new THREE.MeshStandardMaterial({ color: wallColor, roughness: 0.92, transparent: true }),
        filler: new THREE.MeshStandardMaterial({ color: wallColor, roughness: 0.92, transparent: true }),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [walls.length],
  );

  useEffect(() => {
    mats.forEach((m) => {
      m.side.color.set(wallColor);
      m.filler.color.set(wallColor);
    });
  }, [wallColor, mats]);

  useEffect(
    () => () => {
      slabs.forEach((s) => s.geo.dispose());
    },
    [slabs],
  );

  useFrame(({ camera }) => {
    const c = camera.position;
    const ops: number[] = [];
    walls.forEach((w, i) => {
      const m = mats[i];
      if (!m) return;
      const mx = (w.a.x + w.b.x) / 2;
      const mz = (w.a.z + w.b.z) / 2;
      const s = -((c.x - mx) * w.nIn.x + (c.z - mz) * w.nIn.z);
      // walls facing the camera disappear; their dark top cap stays as an outline
      const target = inside || bridge.solidWalls || s < 0.05 ? 1 : 0;
      const o = bridge.solidWalls ? 1 : m.side.opacity + (target - m.side.opacity) * 0.2;
      ops[i] = o;
      m.side.opacity = o;
      m.side.depthWrite = o > 0.9;
      m.side.visible = o > 0.02;
      m.cap.opacity = Math.max(o, bridge.capturing ? 0 : 0.35);
      m.cap.visible = m.cap.opacity > 0.02;
      m.cap.depthWrite = o > 0.9;
    });
    walls.forEach((_, i) => {
      const m = mats[i];
      if (!m) return;
      const o = Math.max(ops[i] ?? 1, ops[(i - 1 + n) % n] ?? 1);
      m.filler.opacity = o;
      m.filler.visible = o > 0.02;
      m.filler.depthWrite = o > 0.9;
    });
    bridge.wallFade = ops;
  });

  return (
    <group>
      <mesh geometry={floorGeo} material={floorMat(design.floor)} position-y={0.001} receiveShadow name="floor" />
      <mesh geometry={ceilGeo} name="ceiling">
        <meshStandardMaterial color="#fbfaf8" roughness={0.95} />
      </mesh>
      {slabs.map((s, i) => (
        <group key={i} position={[s.origin.x, 0, s.origin.z]} rotation-y={s.rot}>
          <mesh geometry={s.geo} material={mats[i]?.side} castShadow receiveShadow name={`wall-${i}`} />
        </group>
      ))}
      {fillers.map((g, i) => (g ? <mesh key={`f${i}`} geometry={g} material={mats[i]?.filler} castShadow receiveShadow /> : null))}
      {caps.map((g, i) => (
        <mesh key={`c${i}`} geometry={g} material={mats[i]?.cap} />
      ))}
      <Worktops design={design} />
    </group>
  );
}

/** Continuous worktops along walls (with sink cut-outs) and the backsplash above them. */
function Worktops({ design }: { design: Design }) {
  const runs = useMemo(() => computeRuns(design), [design]);
  const geos = useMemo(
    () =>
      runs.map((r) => ({
        top: slabGeo(r.len, r.depth, 0.03, r.holes),
        splash: r.splashH > 0.02 ? planeMetres(r.len, r.splashH, r.u0, r.h + 0.03) : null,
      })),
    [runs],
  );
  useEffect(
    () => () => {
      geos.forEach((g) => {
        g.top.dispose();
        g.splash?.dispose();
      });
    },
    [geos],
  );
  return (
    <group>
      {runs.map((r, i) => (
        <group key={r.key} position={[r.origin.x, 0, r.origin.z]} rotation-y={r.rot}>
          <mesh geometry={geos[i].top} material={topMat(r.top)} position-y={r.h} castShadow receiveShadow />
          {geos[i].splash && (
            <mesh geometry={geos[i].splash!} material={splashMat(design.backsplash)} position={[r.len / 2, r.h + 0.03 + r.splashH / 2, 0.004]} receiveShadow />
          )}
        </group>
      ))}
    </group>
  );
}
