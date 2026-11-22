import { create } from 'zustand';
import { uid } from './catalog';
import { autoLayout, designFromPreset, PRESETS } from './layout';
import { findSpot, reflowAll } from './placement';
import type { Design, ItemType, Lang } from './types';

const KEY = 'roomcraft-design-v1';

function loadSaved(): Design | null {
  try {
    const s = localStorage.getItem(KEY);
    if (!s) return null;
    const d = JSON.parse(s);
    return isDesign(d) ? d : null;
  } catch {
    return null;
  }
}

export function isDesign(d: unknown): d is Design {
  const x = d as Design;
  return !!x && Array.isArray(x.plan) && x.plan.length >= 3 && Array.isArray(x.items) && typeof x.wallH === 'number';
}

export type View = '3d' | 'plan' | 'pano';

interface State {
  design: Design;
  past: Design[];
  future: Design[];
  selected: string | null;
  view: View;
  lang: Lang;
  night: boolean;
  busy: boolean;
  camKey: number;
  modal: null | { kind: 'hd' | 'pano'; url: string };
  update: (fn: (d: Design) => void, record?: boolean) => void;
  checkpoint: () => void;
  undo: () => void;
  redo: () => void;
  select: (id: string | null) => void;
  setView: (v: View) => void;
  setLang: (l: Lang) => void;
  setNight: (n: boolean) => void;
  setBusy: (b: boolean) => void;
  setModal: (m: State['modal']) => void;
  resetCamera: () => void;
  addItem: (t: ItemType) => void;
  removeSelected: () => void;
  duplicateSelected: () => void;
  applyPreset: (id: string) => void;
  runAutoLayout: () => void;
  loadDesign: (d: Design) => void;
}

const initial = loadSaved() ?? designFromPreset(PRESETS[0]);

export const useStore = create<State>()((set, get) => ({
  design: initial,
  past: [],
  future: [],
  selected: null,
  view: '3d',
  lang: 'zh',
  night: false,
  busy: false,
  camKey: 0,
  modal: null,

  update: (fn, record = true) => {
    const prev = get().design;
    const d = structuredClone(prev);
    fn(d);
    set((s) => (record ? { design: d, past: [...s.past.slice(-60), prev], future: [] } : { design: d }));
  },
  checkpoint: () => set((s) => ({ past: [...s.past.slice(-60), s.design], future: [] })),
  undo: () => {
    const { past, design, future } = get();
    if (!past.length) return;
    set({ design: past[past.length - 1], past: past.slice(0, -1), future: [design, ...future] });
  },
  redo: () => {
    const { past, design, future } = get();
    if (!future.length) return;
    set({ design: future[0], future: future.slice(1), past: [...past, design] });
  },
  select: (id) => set({ selected: id }),
  setView: (view) => set({ view, selected: view === 'pano' ? null : get().selected }),
  setLang: (lang) => set({ lang }),
  setNight: (night) => set({ night }),
  setBusy: (busy) => set({ busy }),
  setModal: (modal) => set({ modal }),
  resetCamera: () => set((s) => ({ camKey: s.camKey + 1 })),

  addItem: (t) => {
    let id = '';
    get().update((d) => {
      const it = findSpot(t, d);
      id = it.id;
      d.items.push(it);
    });
    set({ selected: id });
  },
  removeSelected: () => {
    const id = get().selected;
    if (!id) return;
    get().update((d) => {
      d.items = d.items.filter((i) => i.id !== id);
    });
    set({ selected: null });
  },
  duplicateSelected: () => {
    const id = get().selected;
    const src = get().design.items.find((i) => i.id === id);
    if (!src) return;
    let nid = '';
    get().update((d) => {
      const copy = structuredClone(src);
      copy.id = uid();
      nid = copy.id;
      // step sideways along the module's own width axis
      const step = src.w + 0.002;
      copy.x += Math.cos(src.rot) * step;
      copy.z -= Math.sin(src.rot) * step;
      d.items.push(copy);
      reflowAll(d);
    });
    set({ selected: nid });
  },
  applyPreset: (id) => {
    const p = PRESETS.find((x) => x.id === id) ?? PRESETS[0];
    const meta = get().design.meta;
    get().update((d) => {
      const n = designFromPreset(p);
      Object.assign(d, n, { meta });
    });
    set((s) => ({ selected: null, camKey: s.camKey + 1 }));
  },
  runAutoLayout: () => {
    get().update((d) => {
      d.items = autoLayout(d);
    });
    set({ selected: null });
  },
  loadDesign: (nd) => {
    get().update((d) => {
      Object.assign(d, nd);
      if (!d.meta) d.meta = { client: '', address: '' };
    });
    set((s) => ({ selected: null, camKey: s.camKey + 1 }));
  },
}));

let saveTimer: number | undefined;
useStore.subscribe((s, prev) => {
  if (s.design === prev.design) return;
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(s.design));
    } catch {
      /* storage may be unavailable; the design still lives in memory */
    }
  }, 400);
});

if (import.meta.env.DEV) (window as unknown as { __store: typeof useStore }).__store = useStore;
