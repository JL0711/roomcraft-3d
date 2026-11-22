import { Grid, Html, OrbitControls } from '@react-three/drei';
import { Canvas, useThree, type ThreeEvent } from '@react-three/fiber';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { bridge } from '../capture';
import { itemSpan, itemWidth } from '../catalog';
import { bounds, centroid, mm } from '../geometry';
import { panoEye } from '../layout';
import { collides, place } from '../placement';
import { useStore } from '../store';
import type { Item } from '../types';
import { ItemModel } from './models';
import { Room } from './Room';

export default function Viewport() {
  const select = useStore((s) => s.select);
  return (
    <Canvas
      shadows="percentage"
      dpr={[1, 2]}
      gl={{ preserveDrawingBuffer: true, antialias: true }}
      camera={{ fov: 45, near: 0.05, far: 200, position: [6, 7, 9] }}
      onPointerMissed={() => select(null)}
    >
      <Content />
    </Canvas>
  );
}

function Environment({ night }: { night: boolean }) {
  const { gl, scene } = useThree();
  useEffect(() => {
    const pm = new THREE.PMREMGenerator(gl);
    const rt = pm.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = rt.texture;
    return () => {
      scene.environment = null;
      rt.dispose();
      pm.dispose();
    };
  }, [gl, scene]);
  useEffect(() => {
    scene.environmentIntensity = night ? 0.05 : 0.38;
  }, [night, scene]);
  return null;
}

function Sun({ cx, cz, r, night }: { cx: number; cz: number; r: number; night: boolean }) {
  const ref = useRef<THREE.DirectionalLight>(null!);
  const { scene } = useThree();
  useEffect(() => {
    const l = ref.current;
    l.target.position.set(cx, 0, cz);
    scene.add(l.target);
    const cam = l.shadow.camera;
    cam.left = -r;
    cam.right = r;
    cam.top = r;
    cam.bottom = -r;
    cam.near = 0.5;
    cam.far = 40;
    cam.updateProjectionMatrix();
    return () => {
      scene.remove(l.target);
    };
  }, [cx, cz, r, scene]);
  return (
    <directionalLight
      ref={ref}
      position={[cx + r * 0.5, 9, cz + r * 0.8]}
      intensity={night ? 0.03 : 1.5}
      castShadow
      shadow-mapSize={[2048, 2048]}
      shadow-bias={-0.0004}
      shadow-normalBias={0.03}
      shadow-radius={4}
    />
  );
}

function SelectionBox({ it, wallH, warn }: { it: Item; wallH: number; warn: boolean }) {
  const [y0, y1] = itemSpan(it, wallH);
  const w = itemWidth(it) + 0.03;
  const h = y1 - y0 + 0.03;
  const d = it.d + 0.03;
  const geo = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, d)), [w, h, d]);
  const color = warn ? '#e5484d' : '#ff7a1a';
  return (
    <group position-y={(y0 + y1) / 2}>
      <lineSegments geometry={geo} renderOrder={10}>
        <lineBasicMaterial color={color} depthTest={false} transparent />
      </lineSegments>
      <mesh renderOrder={9} raycast={() => null}>
        <boxGeometry args={[w, h, d]} />
        <meshBasicMaterial color={color} transparent opacity={0.12} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}

type DragState = { id: string; plane: THREE.Plane; off: THREE.Vector2; moved: boolean };

function Content() {
  const design = useStore((s) => s.design);
  const view = useStore((s) => s.view);
  const night = useStore((s) => s.night);
  const selected = useStore((s) => s.selected);
  const camKey = useStore((s) => s.camKey);
  const { gl, scene, camera } = useThree();
  const aspect = useThree((s) => s.size.width / Math.max(1, s.size.height));
  const controls = useThree((s) => s.controls) as unknown as {
    target: THREE.Vector3;
    enabled: boolean;
    update: () => void;
    minDistance: number;
    maxDistance: number;
    enablePan: boolean;
    enableZoom: boolean;
    rotateSpeed: number;
    minPolarAngle: number;
    maxPolarAngle: number;
  } | null;

  useEffect(() => {
    bridge.gl = gl;
    bridge.scene = scene;
    bridge.camera = camera;
  }, [gl, scene, camera]);

  const ctr = useMemo(() => centroid(design.plan), [design.plan]);
  const b = useMemo(() => bounds(design.plan), [design.plan]);
  const size = Math.max(b.maxX - b.minX, b.maxZ - b.minZ);
  const inside = view === 'pano';

  // camera: orbit around the room, or stand inside it for the 360° walk-in
  const orbitPose = useRef<{ pos: THREE.Vector3; target: THREE.Vector3 } | null>(null);
  const defaultPose = useCallback(() => {
    const cx = (b.minX + b.maxX) / 2;
    const cz = (b.minZ + b.maxZ) / 2;
    // narrow (portrait) viewports need the camera further back to fit the room
    const s = (size * 0.78 + 1.5) * Math.min(2.2, Math.max(1, 1.35 / aspect));
    return { pos: new THREE.Vector3(cx + s * 0.55, s * 0.95, cz + s * 1.05), target: new THREE.Vector3(cx, 0.7, cz) };
  }, [b, size, aspect]);

  useEffect(() => {
    if (!controls) return;
    const cam = camera as THREE.PerspectiveCamera;
    if (view === 'pano') {
      orbitPose.current = { pos: cam.position.clone(), target: controls.target.clone() };
      const pe = panoEye(useStore.getState().design);
      const eye = new THREE.Vector3(pe.eye.x, 1.55, pe.eye.z);
      controls.target.copy(eye);
      cam.position.set(eye.x - pe.look.x * 0.05, eye.y, eye.z - pe.look.z * 0.05);
      cam.fov = 70;
      Object.assign(controls, { minDistance: 0.02, maxDistance: 0.1, enablePan: false, enableZoom: false, rotateSpeed: -0.35, minPolarAngle: 0.05, maxPolarAngle: Math.PI - 0.05 });
    } else {
      const pose = orbitPose.current ?? defaultPose();
      orbitPose.current = null;
      controls.target.copy(pose.target);
      cam.position.copy(pose.pos);
      cam.fov = 45;
      Object.assign(controls, { minDistance: 1.2, maxDistance: 40, enablePan: true, enableZoom: true, rotateSpeed: 0.8, minPolarAngle: 0, maxPolarAngle: 1.52 });
    }
    cam.updateProjectionMatrix();
    controls.update();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, controls]);

  useEffect(() => {
    if (!controls || view === 'pano') return;
    const pose = defaultPose();
    controls.target.copy(pose.target);
    camera.position.copy(pose.pos);
    controls.update();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camKey, controls]);

  // dragging modules across the floor (or along their own height for wall units)
  const drag = useRef<DragState | null>(null);
  const raycaster = useMemo(() => new THREE.Raycaster(), []);

  const onMove = useCallback(
    (e: PointerEvent) => {
      const st = drag.current;
      if (!st) return;
      const rect = gl.domElement.getBoundingClientRect();
      const ndc = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      const hit = new THREE.Vector3();
      if (!raycaster.ray.intersectPlane(st.plane, hit)) return;
      const { design: d, update, checkpoint } = useStore.getState();
      const it = d.items.find((i) => i.id === st.id);
      if (!it) return;
      const target = { x: hit.x + st.off.x, z: hit.z + st.off.y };
      const pl = place(it, target, d);
      if (!pl) return;
      if (Math.abs(pl.x - it.x) < 1e-4 && Math.abs(pl.z - it.z) < 1e-4 && pl.rot === it.rot) return;
      if (!st.moved) {
        checkpoint();
        st.moved = true;
      }
      update((dd) => {
        const x = dd.items.find((i) => i.id === st.id);
        if (x) Object.assign(x, pl);
      }, false);
    },
    [camera, gl, raycaster],
  );

  const onUp = useCallback(() => {
    drag.current = null;
    if (controls) controls.enabled = true;
    document.body.style.cursor = '';
    window.removeEventListener('pointermove', onMove);
  }, [controls, onMove]);

  const onItemDown = useCallback(
    (e: ThreeEvent<PointerEvent>, it: Item) => {
      if (useStore.getState().view === 'pano') return;
      e.stopPropagation();
      useStore.getState().select(it.id);
      if (e.button !== 0) return;
      const [y0, y1] = itemSpan(it, useStore.getState().design.wallH);
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(y0 + y1) / 2);
      const hit = new THREE.Vector3();
      if (!e.ray.intersectPlane(plane, hit)) return;
      drag.current = { id: it.id, plane, off: new THREE.Vector2(it.x - hit.x, it.z - hit.z), moved: false };
      if (controls) controls.enabled = false;
      document.body.style.cursor = 'grabbing';
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp, { once: true });
    },
    [controls, onMove, onUp],
  );

  useEffect(() => () => window.removeEventListener('pointermove', onMove), [onMove]);

  const sel = design.items.find((i) => i.id === selected) ?? null;
  const warn = sel ? collides(sel, design) : false;

  return (
    <>
      <color attach="background" args={[night ? '#1a1d23' : '#ebe8e3']} />
      <Environment night={night} />
      <hemisphereLight args={['#ffffff', '#cfc6b8', night ? 0.03 : 0.35]} />
      <Sun cx={ctr.x} cz={ctr.z} r={size / 2 + 1.5} night={night} />
      <OrbitControls makeDefault enableDamping dampingFactor={0.12} />

      <mesh rotation-x={-Math.PI / 2} position={[ctr.x, -0.006, ctr.z]}>
        <planeGeometry args={[80, 80]} />
        <meshStandardMaterial color={night ? '#202329' : '#e3dfd9'} roughness={1} />
      </mesh>
      {!inside && (
        <Grid
          position={[ctr.x, -0.004, ctr.z]}
          args={[40, 40]}
          cellSize={0.5}
          sectionSize={1}
          cellColor={night ? '#2c3038' : '#d3cdc4'}
          sectionColor={night ? '#383d47' : '#c2baae'}
          fadeDistance={28}
          fadeStrength={1.5}
          infiniteGrid
        />
      )}

      <group name="design">
        <Room design={design} inside={inside} />
        {design.items.map((it) => (
          <group
            key={it.id}
            name={`${it.type}-${it.id}`}
            position={[it.x, 0, it.z]}
            rotation-y={it.rot}
            onPointerDown={(e) => onItemDown(e, it)}
            onPointerOver={(e) => {
              e.stopPropagation();
              if (!drag.current && !inside) document.body.style.cursor = 'grab';
            }}
            onPointerOut={() => {
              if (!drag.current) document.body.style.cursor = '';
            }}
          >
            <ItemModel it={it} wallH={design.wallH} night={night} />
          </group>
        ))}
      </group>

      {sel && view === '3d' && (
        <group position={[sel.x, 0, sel.z]} rotation-y={sel.rot}>
          <SelectionBox it={sel} wallH={design.wallH} warn={warn} />
          <Html position={[0, itemSpan(sel, design.wallH)[1] + 0.14, 0]} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
            <div className={`dim-tag${warn ? ' warn' : ''}`}>
              {mm(sel.w)} × {mm(sel.h)} × {mm(sel.d)} mm
            </div>
          </Html>
        </group>
      )}
    </>
  );
}
