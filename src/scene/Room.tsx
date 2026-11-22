import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { bridge } from '../capture';
import { outerPoints, wallsOf } from '../geometry';
import { floorMat } from '../materials';
import type { Design } from '../types';

/**
 * Floor, ceiling and walls generated from the floor-plan polygon. Walls are
 * mitred at every corner, and the ones between the camera and the room fade
 * out so the inside stays visible from any angle (a "cutaway" view).
 */
export function Room({ design, inside }: { design: Design; inside: boolean }) {
  const { plan, wallH, wallColor } = design;
  const walls = useMemo(() => wallsOf(plan), [plan]);
  const outer = useMemo(() => outerPoints(plan), [plan]);

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

  const wallGeos = useMemo(
    () =>
      walls.map((w, i) => {
        const j = (i + 1) % plan.length;
        const quad = [plan[i], plan[j], outer[j], outer[i]];
        const g = new THREE.ExtrudeGeometry(new THREE.Shape(quad.map((p) => new THREE.Vector2(p.x, -p.z))), {
          depth: wallH,
          bevelEnabled: false,
        });
        g.rotateX(-Math.PI / 2);
        return g;
      }),
    [walls, outer, plan, wallH],
  );

  // one material pair per wall so each wall can fade on its own
  const mats = useMemo(
    () =>
      walls.map(() => ({
        cap: new THREE.MeshStandardMaterial({ color: '#57534e', roughness: 0.9, transparent: true }),
        side: new THREE.MeshStandardMaterial({ color: wallColor, roughness: 0.92, transparent: true }),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [walls.length],
  );

  useEffect(() => {
    mats.forEach((m) => m.side.color.set(wallColor));
  }, [wallColor, mats]);

  useEffect(
    () => () => {
      wallGeos.forEach((g) => g.dispose());
    },
    [wallGeos],
  );

  useFrame(({ camera }) => {
    const c = camera.position;
    walls.forEach((w, i) => {
      const m = mats[i];
      if (!m) return;
      const mx = (w.a.x + w.b.x) / 2;
      const mz = (w.a.z + w.b.z) / 2;
      const s = -((c.x - mx) * w.nIn.x + (c.z - mz) * w.nIn.z);
      // walls facing the camera disappear; their dark top cap stays as an outline
      const target = inside || bridge.solidWalls || s < 0.05 ? 1 : 0;
      const o = bridge.solidWalls ? 1 : m.side.opacity + (target - m.side.opacity) * 0.2;
      m.side.opacity = o;
      m.side.depthWrite = o > 0.9;
      m.side.visible = o > 0.02;
      m.cap.opacity = Math.max(o, bridge.capturing ? 0 : 0.35);
      m.cap.visible = m.cap.opacity > 0.02;
      m.cap.depthWrite = o > 0.9;
    });
  });

  return (
    <group>
      <mesh geometry={floorGeo} material={floorMat(design.floor)} position-y={0.001} receiveShadow name="floor" />
      <mesh geometry={ceilGeo} name="ceiling">
        <meshStandardMaterial color="#fbfaf8" roughness={0.95} />
      </mesh>
      {wallGeos.map((g, i) => (
        <mesh key={i} geometry={g} material={mats[i] ? [mats[i].cap, mats[i].side] : undefined} receiveShadow name={`wall-${i}`} />
      ))}
    </group>
  );
}
