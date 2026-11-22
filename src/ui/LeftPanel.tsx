import { CATALOG, CATALOG_GROUPS } from '../catalog';
import { area } from '../geometry';
import { nameOf, useT } from '../i18n';
import { PRESETS } from '../layout';
import { BACKSPLASHES, FLOORS, WALL_COLORS } from '../materials';
import { importModelFile } from '../scene/imported';
import { reflowAll } from '../placement';
import { useStore } from '../store';
import { getTexture, type TexKind } from '../textures';
import type { RoomType } from '../types';
import { Row, Segmented, SizeField, Swatches } from './controls';
import { ModuleIcon } from './icons';

const thumbs = new Map<string, string>();
export function texThumb(kind: TexKind) {
  let u = thumbs.get(kind);
  if (!u) {
    const src = getTexture(kind).image as HTMLCanvasElement;
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    c.getContext('2d')!.drawImage(src, 0, 0, src.width / 2, src.height / 2, 0, 0, 64, 64);
    u = c.toDataURL();
    thumbs.set(kind, u);
  }
  return u;
}

export function LeftPanel() {
  const t = useT();
  const lang = useStore((s) => s.lang);
  const design = useStore((s) => s.design);
  const night = useStore((s) => s.night);
  const { addItem, update, applyPreset, runAutoLayout, setNight } = useStore.getState();
  const presetId = PRESETS.find((p) => p.roomType === design.roomType)?.id;
  const importGLB = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.glb,.gltf,model/gltf-binary';
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return;
      try {
        const m = await importModelFile(f);
        const r = (v: number) => Math.round(v * 1000) / 1000;
        addItem('model', { w: r(m.size.x), h: r(m.size.y), d: r(m.size.z) }, { modelId: m.id, modelName: m.name });
      } catch {
        alert(t('importFail'));
      }
    };
    input.click();
  };

  return (
    <aside className="panel left">
      <section>
        <h2>{t('addModule')}</h2>
        {CATALOG_GROUPS.map((g) => (
          <div key={g.zh} className="cat-group">
            <h3>{nameOf(lang, g)}</h3>
            <div className="catalog">
              {g.entries.map((e, i) => (
                <button key={i} type="button" className="module-btn" onClick={() => addItem(e.type, e.over, e.p)}>
                  <ModuleIcon type={e.type} />
                  <span>{e.zh ? nameOf(lang, { zh: e.zh, en: e.en ?? e.zh }) : nameOf(lang, CATALOG[e.type])}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
        <button type="button" className="btn block import-btn" onClick={importGLB}>
          <ModuleIcon type="model" /> {t('importModel')}
        </button>
        <p className="hint">{t('addHint')}</p>
        <p className="hint">{t('importHint')}</p>
      </section>

      <section>
        <h2>{t('autoLayout')}</h2>
        <button
          type="button"
          className="btn primary block"
          onClick={() => {
            if (!design.items.length || confirm(t('autoConfirm'))) runAutoLayout();
          }}
        >
          ✦ {t('autoLayout')}
        </button>
        <p className="hint">{t('autoHint')}</p>
      </section>

      <section>
        <h2>{t('room')}</h2>
        <Row label={t('preset')}>
          <select value={presetId} onChange={(e) => applyPreset(e.target.value)}>
            {PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {nameOf(lang, p)}
              </option>
            ))}
          </select>
        </Row>
        <Row label={t('roomType')}>
          <Segmented<RoomType>
            value={design.roomType}
            options={[
              { v: 'kitchen', label: t('kitchen') },
              { v: 'bedroom', label: t('bedroom') },
              { v: 'living', label: t('living') },
            ]}
            onChange={(v) => update((d) => void (d.roomType = v))}
          />
        </Row>
        <SizeField
          label={t('wallH')}
          value={design.wallH}
          min={2.4}
          max={3.4}
          onChange={(v) =>
            update((d) => {
              d.wallH = v;
              reflowAll(d);
            }, false)
          }
        />
        <Row label={t('floor')}>
          <Swatches
            value={design.floor}
            options={FLOORS.map((f) => ({ id: f.id, label: nameOf(lang, f), image: texThumb(f.tex) }))}
            onChange={(id) => update((d) => void (d.floor = id))}
          />
        </Row>
        <Row label={t('wallColor')}>
          <div className="swatch-row">
            <Swatches
              value={design.wallColor}
              options={WALL_COLORS.map((c) => ({ id: c, label: c, color: c }))}
              onChange={(c) => update((d) => void (d.wallColor = c))}
            />
            <input
              type="color"
              className="color-input"
              aria-label={t('customColor')}
              value={design.wallColor}
              onChange={(e) => update((d) => void (d.wallColor = e.target.value), false)}
            />
          </div>
        </Row>
        {(design.roomType === 'kitchen' || design.items.some((i) => i.type === 'base' && i.wall !== null)) && (
          <Row label={t('backsplash')}>
            <Swatches
              value={design.backsplash ?? 'subway'}
              options={BACKSPLASHES.map((b) => ({
                id: b.id,
                label: nameOf(lang, b),
                image: b.tex ? texThumb(b.tex) : undefined,
                color: b.tex ? undefined : 'repeating-linear-gradient(45deg,#fff 0 4px,#ddd 4px 8px)',
              }))}
              onChange={(id) => update((d) => void (d.backsplash = id))}
            />
          </Row>
        )}
        <Row label={t('lighting')}>
          <Segmented<string>
            value={night ? 'night' : 'day'}
            options={[
              { v: 'day', label: `☀ ${t('day')}` },
              { v: 'night', label: `☾ ${t('night')}` },
            ]}
            onChange={(v) => setNight(v === 'night')}
          />
        </Row>
        <p className="hint">
          {t('floorArea')} {area(design.plan).toFixed(2)} m²
        </p>
      </section>
      <p className="hint small">{t('shortcuts')}</p>
    </aside>
  );
}
