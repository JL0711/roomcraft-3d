import * as THREE from 'three';
import { bridge, capturePanorama, downloadBlob, exportGLB, frames, renderHD } from './capture';
import { panoEye } from './layout';
import { tr } from './i18n';
import { exportQuotePDF } from './pdf';
import { isDesign, useStore } from './store';

/** Hides the selection box (and optionally the cutaway) for a frame, then runs a capture. */
async function capture<T>(solid: boolean, fn: () => T | Promise<T>): Promise<T> {
  const s = useStore.getState();
  const prev = s.selected;
  s.select(null);
  s.setBusy(true);
  bridge.solidWalls = solid;
  bridge.capturing = true;
  try {
    await frames(3);
    return await fn();
  } finally {
    bridge.solidWalls = false;
    bridge.capturing = false;
    s.setBusy(false);
    if (prev && useStore.getState().design.items.some((i) => i.id === prev)) useStore.getState().select(prev);
  }
}

export async function hdRender() {
  const url = await capture(false, () => renderHD(3840));
  useStore.getState().setModal({ kind: 'hd', url });
}

export async function panorama() {
  const d = useStore.getState().design;
  const { eye } = panoEye(d);
  const url = await capture(true, () => capturePanorama(new THREE.Vector3(eye.x, 1.55, eye.z), 4096));
  useStore.getState().setModal({ kind: 'pano', url });
}

export async function glb() {
  const blob = await capture(true, () => exportGLB());
  downloadBlob(blob, 'roomcraft-design.glb');
}

export async function quotePDF() {
  const { design, lang } = useStore.getState();
  const shot = await capture(false, () => renderHD(2000));
  useStore.getState().setBusy(true);
  try {
    await exportQuotePDF(design, lang, shot);
  } finally {
    useStore.getState().setBusy(false);
  }
}

export function saveDesign() {
  const d = useStore.getState().design;
  downloadBlob(new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' }), 'roomcraft-design.json');
}

export function openDesign() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json,.json';
  input.onchange = async () => {
    const f = input.files?.[0];
    if (!f) return;
    try {
      const d = JSON.parse(await f.text());
      if (!isDesign(d)) throw new Error('bad');
      useStore.getState().loadDesign(d);
    } catch {
      alert(tr(useStore.getState().lang, 'badFile'));
    }
  };
  input.click();
}
