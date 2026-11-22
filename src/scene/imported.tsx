import { Html } from '@react-three/drei';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { create } from 'zustand';
import type { Item } from '../types';

/**
 * glTF / GLB import. A model is parsed once, normalised so its footprint is
 * centred on the origin and it stands on the floor, and kept as a template
 * that every placed copy clones. The raw file also goes into IndexedDB so
 * the design still shows the model after a page reload.
 */

interface Template {
  scene: THREE.Object3D;
  size: THREE.Vector3;
}

const templates = new Map<string, Template>();
const useModels = create<{ version: number; failed: Record<string, true> }>(() => ({ version: 0, failed: {} }));
const bump = () => useModels.setState((s) => ({ version: s.version + 1 }));

const DB = 'roomcraft-models';
function idb(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('files');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function idbPut(id: string, buf: ArrayBuffer) {
  try {
    const db = await idb();
    await new Promise<void>((res, rej) => {
      const tx = db.transaction('files', 'readwrite');
      tx.objectStore('files').put(buf, id);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  } catch {
    /* storage unavailable: the model still works until the page is closed */
  }
}
async function idbGet(id: string): Promise<ArrayBuffer | null> {
  try {
    const db = await idb();
    return await new Promise((res, rej) => {
      const r = db.transaction('files').objectStore('files').get(id);
      r.onsuccess = () => res((r.result as ArrayBuffer) ?? null);
      r.onerror = () => rej(r.error);
    });
  } catch {
    return null;
  }
}

async function parse(id: string, buf: ArrayBuffer): Promise<Template> {
  const gltf = await new GLTFLoader().parseAsync(buf, '');
  const root = gltf.scene;
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const max = Math.max(size.x, size.y, size.z);
  // models exported in centimetres or millimetres come in far too big; bring them to about 1 m
  const k = max > 8 || max < 0.03 ? 1 / max : 1;
  const center = box.getCenter(new THREE.Vector3());
  const holder = new THREE.Group();
  root.position.sub(new THREE.Vector3(center.x, box.min.y, center.z));
  holder.add(root);
  holder.scale.setScalar(k);
  holder.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
  });
  const t = { scene: holder, size: size.multiplyScalar(k) };
  templates.set(id, t);
  return t;
}

export async function importModelFile(file: File) {
  const buf = await file.arrayBuffer();
  const id = `glb-${Date.now().toString(36)}`;
  const t = await parse(id, buf.slice(0));
  void idbPut(id, buf);
  bump();
  return { id, name: file.name.replace(/\.(glb|gltf)$/i, ''), size: t.size };
}

const loading = new Set<string>();
async function ensureLoaded(id: string) {
  if (templates.has(id) || loading.has(id)) return;
  loading.add(id);
  const buf = await idbGet(id);
  try {
    if (!buf) throw new Error('missing');
    await parse(id, buf);
  } catch {
    useModels.setState((s) => ({ failed: { ...s.failed, [id]: true } }));
  }
  loading.delete(id);
  bump();
}

export function ImportedModel({ it }: { it: Item }) {
  const id = it.p.modelId ?? '';
  useModels((s) => s.version);
  const failed = useModels((s) => !!s.failed[id]);
  useEffect(() => {
    void ensureLoaded(id);
  }, [id]);
  const tpl = templates.get(id);
  const obj = useMemo(() => (tpl ? tpl.scene.clone(true) : null), [tpl]);
  if (!tpl || !obj) {
    return (
      <group>
        <mesh position-y={it.h / 2}>
          <boxGeometry args={[it.w, it.h, it.d]} />
          <meshStandardMaterial color="#c9c3ba" transparent opacity={0.35} />
        </mesh>
        {failed && (
          <Html position={[0, it.h + 0.15, 0]} center style={{ pointerEvents: 'none' }}>
            <div className="dim-tag warn">{it.p.modelName ?? 'model'} · reimport</div>
          </Html>
        )}
      </group>
    );
  }
  const s = tpl.size;
  return (
    <group scale={[it.w / Math.max(1e-3, s.x), it.h / Math.max(1e-3, s.y), it.d / Math.max(1e-3, s.z)]}>
      <primitive object={obj} />
    </group>
  );
}
