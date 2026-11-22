import { useMemo, useRef, useState, type PointerEvent as RPE } from 'react';
import { CATALOG } from '../catalog';
import { area, bounds, mm, perimeter, snap, wallsOf, WALL_T } from '../geometry';
import { nameOf, useT } from '../i18n';
import { downloadBlob } from '../capture';
import { footprint, reflowAll } from '../placement';
import { useStore } from '../store';
import type { Vec2 } from '../types';

interface Underlay {
  url: string;
  w: number;
  aspect: number;
  opacity: number;
}

/**
 * 2D floor-plan editor. Corners can be dragged, added and removed, and any
 * wall can be given an exact length. A scanned floor plan can be placed
 * underneath at real scale and traced over.
 */
export function PlanEditor() {
  const t = useT();
  const lang = useStore((s) => s.lang);
  const design = useStore((s) => s.design);
  const selected = useStore((s) => s.selected);
  const { update, checkpoint, select } = useStore.getState();
  const svgRef = useRef<SVGSVGElement>(null);
  const dragIdx = useRef<number | null>(null);
  const [frozenVB, setFrozenVB] = useState<string | null>(null);
  const [under, setUnder] = useState<Underlay | null>(null);
  const plan = design.plan;
  const walls = useMemo(() => wallsOf(plan), [plan]);

  const vb = useMemo(() => {
    const b = bounds(plan);
    let { minX, maxX, minZ, maxZ } = b;
    if (under) {
      minX = Math.min(minX, -under.w / 2);
      maxX = Math.max(maxX, under.w / 2);
      minZ = Math.min(minZ, (-under.w * under.aspect) / 2);
      maxZ = Math.max(maxZ, (under.w * under.aspect) / 2);
    }
    const pad = 1.3;
    return `${minX - pad} ${minZ - pad} ${maxX - minX + pad * 2} ${maxZ - minZ + pad * 2}`;
  }, [plan, under]);
  const viewBox = frozenVB ?? vb;

  const toLocal = (e: { clientX: number; clientY: number }): Vec2 => {
    const svg = svgRef.current!;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const q = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    return { x: q.x, z: q.y };
  };

  const onVertexDown = (i: number, e: RPE<SVGCircleElement>) => {
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    checkpoint();
    dragIdx.current = i;
    setFrozenVB(vb);
  };

  const onMove = (e: RPE<SVGSVGElement>) => {
    const i = dragIdx.current;
    if (i === null) return;
    let p = toLocal(e);
    if (!e.altKey) {
      p = { x: snap(p.x, 0.05), z: snap(p.z, 0.05) };
      // keep walls square: align with the neighbouring corners when close
      const n = plan.length;
      for (const j of [(i - 1 + n) % n, (i + 1) % n]) {
        if (Math.abs(p.x - plan[j].x) < 0.12) p.x = plan[j].x;
        if (Math.abs(p.z - plan[j].z) < 0.12) p.z = plan[j].z;
      }
    }
    update((d) => {
      d.plan[i] = p;
      reflowAll(d);
    }, false);
  };

  const onUp = () => {
    dragIdx.current = null;
    setFrozenVB(null);
  };

  const insertAt = (i: number) => {
    const a = plan[i];
    const b = plan[(i + 1) % plan.length];
    update((d) => {
      d.plan.splice(i + 1, 0, { x: snap((a.x + b.x) / 2, 0.05), z: snap((a.z + b.z) / 2, 0.05) });
      reflowAll(d);
    });
  };

  const removeAt = (i: number) => {
    if (plan.length <= 3) return;
    update((d) => {
      d.plan.splice(i, 1);
      reflowAll(d);
    });
  };

  /** Stretch the room along a wall: everything beyond the wall's far end moves with it. */
  const setLength = (i: number) => {
    const w = walls[i];
    const v = prompt(t('enterLength'), String(mm(w.len)));
    if (!v) return;
    const nl = Number(v) / 1000;
    if (!Number.isFinite(nl) || nl < 0.3 || nl > 40) return;
    const delta = nl - w.len;
    update((d) => {
      d.plan = d.plan.map((p, j) => {
        if (j === i) return p;
        const along = (p.x - w.a.x) * w.dir.x + (p.z - w.a.z) * w.dir.z;
        return along >= w.len - 1e-6 ? { x: p.x + w.dir.x * delta, z: p.z + w.dir.z * delta } : p;
      });
      reflowAll(d);
    });
  };

  const loadImage = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => {
      const f = input.files?.[0];
      if (!f) return;
      const r = new FileReader();
      r.onload = () => {
        const url = String(r.result);
        const im = new Image();
        im.onload = () => setUnder({ url, w: 8, aspect: im.height / im.width, opacity: 0.45 });
        im.src = url;
      };
      r.readAsDataURL(f);
    };
    input.click();
  };

  const importJSON = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return;
      try {
        const j = JSON.parse(await f.text());
        const pts: Vec2[] = (Array.isArray(j) ? j : j.plan).map((p: { x: number; z?: number; y?: number }) => ({ x: Number(p.x), z: Number(p.z ?? p.y) }));
        if (pts.length < 3 || pts.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.z))) throw new Error('bad');
        update((d) => {
          d.plan = pts;
          if (typeof j.wallH === 'number') d.wallH = j.wallH;
          reflowAll(d);
        });
        useStore.getState().resetCamera();
      } catch {
        alert(t('badFile'));
      }
    };
    input.click();
  };

  const exportJSON = () => {
    const out = { units: 'metres', wallH: design.wallH, plan: plan.map((p) => ({ x: +p.x.toFixed(3), z: +p.z.toFixed(3) })) };
    downloadBlob(new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' }), 'floor-plan.json');
  };

  const poly = plan.map((p) => `${p.x},${p.z}`).join(' ');

  return (
    <div className="plan-editor">
      <div className="plan-tools">
        <button type="button" className="btn" onClick={loadImage}>
          ⬚ {t('importImg')}
        </button>
        {under && (
          <>
            <label className="mini">
              {t('imgWidth')}
              <input type="number" step={0.1} min={1} value={under.w} onChange={(e) => setUnder({ ...under, w: Math.max(1, Number(e.target.value) || 1) })} />
            </label>
            <label className="mini">
              {t('imgOpacity')}
              <input type="range" min={0.1} max={1} step={0.05} value={under.opacity} onChange={(e) => setUnder({ ...under, opacity: Number(e.target.value) })} />
            </label>
            <button type="button" className="btn ghost" onClick={() => setUnder(null)}>
              {t('removeImg')}
            </button>
          </>
        )}
        <span className="spacer" />
        <button type="button" className="btn ghost" onClick={importJSON}>
          {t('importJson')}
        </button>
        <button type="button" className="btn ghost" onClick={exportJSON}>
          {t('exportJson')}
        </button>
      </div>

      <svg ref={svgRef} viewBox={viewBox} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onPointerDown={() => select(null)}>
        <defs>
          <pattern id="minor" width="0.5" height="0.5" patternUnits="userSpaceOnUse">
            <path d="M0.5 0H0V0.5" fill="none" stroke="var(--grid-minor)" strokeWidth="0.008" />
          </pattern>
          <pattern id="major" width="1" height="1" patternUnits="userSpaceOnUse">
            <rect width="1" height="1" fill="url(#minor)" />
            <path d="M1 0H0V1" fill="none" stroke="var(--grid-major)" strokeWidth="0.012" />
          </pattern>
        </defs>
        <rect x={-50} y={-50} width={100} height={100} fill="url(#major)" />
        {under && <image href={under.url} x={-under.w / 2} y={(-under.w * under.aspect) / 2} width={under.w} height={under.w * under.aspect} opacity={under.opacity} preserveAspectRatio="none" />}
        <polygon points={poly} className="room-fill" />
        <polygon points={poly} className="room-wall" strokeWidth={WALL_T} />

        {design.items
          .slice()
          .sort((a, b) => (a.type === 'rug' ? -1 : 0) - (b.type === 'rug' ? -1 : 0))
          .map((it) => {
          if (it.type === 'door') {
            // leaf drawn fully open, with its swing arc into the room
            const c = Math.cos(it.rot);
            const sn = Math.sin(it.rot);
            const w2 = (lx: number, lz: number) => ({ x: it.x + lx * c + lz * sn, z: it.z - lx * sn + lz * c });
            const hinge = w2(-it.w / 2, it.d / 2);
            const closed = w2(it.w / 2, it.d / 2);
            const open = w2(-it.w / 2, it.d / 2 + it.w);
            const fp = footprint(it);
            return (
              <g key={it.id} className={`plan-door${it.id === selected ? ' on' : ''}`} onPointerDown={(e) => { e.stopPropagation(); select(it.id); }}>
                <polygon points={fp.map((p) => `${p.x},${p.z}`).join(' ')} className="door-gap" />
                <path d={`M${hinge.x} ${hinge.z} L${open.x} ${open.z} A${it.w} ${it.w} 0 0 ${it.rot >= 0 ? 0 : 1} ${closed.x} ${closed.z}`} />
                <title>{nameOf(lang, CATALOG[it.type])}</title>
              </g>
            );
          }
          if (CATALOG[it.type].layer === 'ceiling') {
            return (
              <circle
                key={it.id}
                cx={it.x}
                cy={it.z}
                r={it.w / 2}
                className={`plan-item ceiling${it.id === selected ? ' on' : ''}`}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  select(it.id);
                }}
              >
                <title>{nameOf(lang, CATALOG[it.type])}</title>
              </circle>
            );
          }
          const fp = footprint(it);
          return (
            <polygon
              key={it.id}
              points={fp.map((p) => `${p.x},${p.z}`).join(' ')}
              className={`plan-item ${CATALOG[it.type].layer}${it.id === selected ? ' on' : ''}`}
              onPointerDown={(e) => {
                e.stopPropagation();
                select(it.id);
              }}
            >
              <title>{nameOf(lang, CATALOG[it.type])}</title>
            </polygon>
          );
        })}

        {walls.map((w) => {
          const mx = (w.a.x + w.b.x) / 2;
          const mz = (w.a.z + w.b.z) / 2;
          const off = 0.42;
          const lx = mx - w.nIn.x * off;
          const lz = mz - w.nIn.z * off;
          let ang = (Math.atan2(w.dir.z, w.dir.x) * 180) / Math.PI;
          if (ang > 90) ang -= 180;
          if (ang < -90) ang += 180;
          return (
            <g key={w.i}>
              <g transform={`translate(${lx} ${lz}) rotate(${ang})`} className="dim" onClick={() => setLength(w.i)}>
                <rect x={-0.42} y={-0.13} width={0.84} height={0.26} rx={0.06} />
                <text y={0.055}>{mm(w.len)}</text>
              </g>
              <g className="add-pt" onClick={() => insertAt(w.i)} transform={`translate(${mx} ${mz})`}>
                <circle r={0.09} />
                <path d="M-0.045 0H0.045M0 -0.045V0.045" />
              </g>
            </g>
          );
        })}

        {plan.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.z} r={0.11} className="vertex" onPointerDown={(e) => onVertexDown(i, e)} onDoubleClick={() => removeAt(i)} />
        ))}
      </svg>

      <div className="plan-info">
        <span>
          {t('floorArea')} <b>{area(plan).toFixed(2)} m²</b>
        </span>
        <span>
          {t('perimeter')} <b>{perimeter(plan).toFixed(2)} m</b>
        </span>
        <span className="hint">{t('planHint')}</span>
      </div>
    </div>
  );
}
