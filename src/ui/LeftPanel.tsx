import { CATALOG, CATALOG_ORDER } from '../catalog';
import { area } from '../geometry';
import { nameOf, useT } from '../i18n';
import { PRESETS } from '../layout';
import { FLOORS, WALL_COLORS } from '../materials';
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

  return (
    <aside className="panel left">
      <section>
        <h2>{t('addModule')}</h2>
        <div className="catalog">
          {CATALOG_ORDER.map((type) => (
            <button key={type} type="button" className="module-btn" onClick={() => addItem(type)}>
              <ModuleIcon type={type} />
              <span>{nameOf(lang, CATALOG[type])}</span>
            </button>
          ))}
        </div>
        <p className="hint">{t('addHint')}</p>
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
