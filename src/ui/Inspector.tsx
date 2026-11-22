import { CATALOG, shadeHeight } from '../catalog';
import { nameOf, useT } from '../i18n';
import { FABRICS, FINISHES, METALS, TOPS } from '../materials';
import { collides, reflowItem } from '../placement';
import { itemPrice, money } from '../quote';
import { useStore } from '../store';
import type { DoorStyle, HandleStyle, Item, ItemParams, ShadeStyle } from '../types';
import { Row, Segmented, SizeField, Swatches, Toggle } from './controls';
import { ModuleIcon } from './icons';
import { texThumb } from './LeftPanel';

const isCabinet = (it: Item) => ['base', 'wall', 'tall', 'wardrobe'].includes(it.type);

export function Inspector() {
  const t = useT();
  const lang = useStore((s) => s.lang);
  const design = useStore((s) => s.design);
  const selected = useStore((s) => s.selected);
  const { update, removeSelected, duplicateSelected, checkpoint } = useStore.getState();
  const it = design.items.find((i) => i.id === selected);

  if (!it) {
    return (
      <section>
        <h2>{t('props')}</h2>
        <p className="hint">{t('noSel')}</p>
      </section>
    );
  }

  const cat = CATALOG[it.type];
  const setSize = (k: 'w' | 'h' | 'd' | 'elev', v: number, record = false) =>
    update((d) => {
      const x = d.items.find((i) => i.id === it.id);
      if (!x) return;
      x[k] = v;
      if (k === 'w' && (x.type === 'pendant' || x.type === 'ceiling')) x.d = v;
      reflowItem(x, d);
    }, record);
  const setP = (patch: Partial<ItemParams>) =>
    update((d) => {
      const x = d.items.find((i) => i.id === it.id);
      if (x) Object.assign(x.p, patch);
    });
  const p = it.p;
  const warn = collides(it, design);
  const isLight = it.type === 'pendant' || it.type === 'ceiling';
  const maxDrop = Math.max(0.25, design.wallH - shadeHeight(it) - 0.9);

  return (
    <section className="inspector">
      <div className="insp-head">
        <span className="insp-icon">
          <ModuleIcon type={it.type} />
        </span>
        <div>
          <h2>{nameOf(lang, cat)}</h2>
          <span className="price-tag">
            {t('itemPrice')} {money(itemPrice(it))}
          </span>
        </div>
      </div>
      {warn && <p className="warn-box">{t('overlap')}</p>}
      {it.wall === null && (cat.snap === 'free') && <p className="hint">{t('freeStanding')}</p>}

      <SizeField label={isLight ? t('diameter') : t('width')} value={it.w} min={cat.range.w[0]} max={cat.range.w[1]} onChange={(v) => setSize('w', v)} />
      {it.type === 'pendant' && <SizeField label={t('drop')} value={it.h} min={0.2} max={maxDrop} onChange={(v) => setSize('h', v)} />}
      {!isLight && it.type !== 'pendant' && cat.range.h[0] !== cat.range.h[1] && (
        <SizeField
          label={t('height')}
          value={it.h}
          min={cat.range.h[0]}
          max={it.type === 'curtain' ? design.wallH - 0.12 : it.type === 'wall' ? Math.min(cat.range.h[1], design.wallH - it.elev) : Math.min(cat.range.h[1], design.wallH)}
          onChange={(v) => setSize('h', v)}
        />
      )}
      {!isLight && cat.range.d[0] !== cat.range.d[1] && <SizeField label={t('depth')} value={it.d} min={cat.range.d[0]} max={cat.range.d[1]} onChange={(v) => setSize('d', v)} />}
      {cat.range.elev && (
        <SizeField label={t('elev')} value={it.elev} min={cat.range.elev[0]} max={Math.min(cat.range.elev[1], design.wallH - it.h)} onChange={(v) => setSize('elev', v)} />
      )}

      {isCabinet(it) && (
        <>
          {it.type === 'base' && (
            <Row label={t('fixture')}>
              <Segmented
                value={p.fixture ?? 'none'}
                options={[
                  { v: 'none', label: t('fixNone') },
                  { v: 'sink', label: t('sink') },
                  { v: 'hob', label: t('hob') },
                ]}
                onChange={(v) => setP({ fixture: v as 'none' | 'sink' | 'hob' })}
              />
            </Row>
          )}
          {it.type === 'tall' && (
            <Row label={t('appliance')}>
              <Segmented
                value={p.appliance ?? 'none'}
                options={[
                  { v: 'none', label: t('fixNone') },
                  { v: 'oven', label: t('oven') },
                ]}
                onChange={(v) => setP({ appliance: v as 'none' | 'oven' })}
              />
            </Row>
          )}
          {it.type === 'base' && p.fixture !== 'sink' && (
            <Row label={t('layout')}>
              <Segmented
                value={p.layout ?? 'doors'}
                options={[
                  { v: 'doors', label: t('layoutDoors') },
                  { v: 'drawers', label: t('layoutDrawers') },
                ]}
                onChange={(v) => setP({ layout: v as 'doors' | 'drawers' })}
              />
            </Row>
          )}
          {!(it.type === 'base' && p.layout === 'drawers' && p.fixture !== 'sink') && !(it.type === 'tall' && p.appliance === 'oven') && (
            <Row label={t('doors')}>
              <Segmented<number>
                value={p.doors}
                options={(it.type === 'wardrobe' ? [2, 3, 4, 5, 6] : [1, 2, 3, 4]).map((n) => ({ v: n, label: String(n) }))}
                onChange={(v) => setP({ doors: v })}
              />
            </Row>
          )}
          <Row label={t('style')}>
            <Segmented<DoorStyle>
              value={p.style}
              options={[
                { v: 'flat', label: t('flat') },
                { v: 'shaker', label: t('shaker') },
                { v: 'fluted', label: t('fluted') },
              ]}
              onChange={(v) => setP({ style: v })}
            />
          </Row>
          <Row label={t('finish')}>
            <div className="swatch-row">
              <Swatches
                value={p.color ? undefined : p.finish}
                options={FINISHES.map((f) => ({ id: f.id, label: nameOf(lang, f), color: f.color, image: f.tex ? texThumb(f.tex) : undefined }))}
                onChange={(id) => setP({ finish: id, color: undefined })}
              />
              <input
                type="color"
                className={`color-input${p.color ? ' on' : ''}`}
                aria-label={t('customColor')}
                title={t('customColor')}
                value={p.color ?? '#b07a5a'}
                onPointerDown={() => checkpoint()}
                onChange={(e) =>
                  update((d) => {
                    const x = d.items.find((i) => i.id === it.id);
                    if (x) x.p.color = e.target.value;
                  }, false)
                }
              />
            </div>
            <span className="sub">{p.color ? `${t('customColor')} ${p.color}` : nameOf(lang, FINISHES.find((f) => f.id === p.finish) ?? FINISHES[0])}</span>
          </Row>
          <Row label={t('handle')}>
            <Segmented<HandleStyle>
              value={p.handle}
              options={[
                { v: 'bar', label: t('bar') },
                { v: 'knob', label: t('knob') },
                { v: 'none', label: t('none') },
              ]}
              onChange={(v) => setP({ handle: v })}
            />
          </Row>
          {p.handle !== 'none' && (
            <Row label={t('metal')}>
              <Swatches value={p.metal} options={METALS.map((m) => ({ id: m.id, label: nameOf(lang, m), color: m.color }))} onChange={(id) => setP({ metal: id })} />
            </Row>
          )}
          {it.type === 'base' && (
            <Row label={t('top')}>
              <Swatches
                value={p.top}
                options={TOPS.map((x) => ({
                  id: x.id,
                  label: nameOf(lang, x),
                  image: x.tex ? texThumb(x.tex) : undefined,
                  color: x.tex ? undefined : 'repeating-linear-gradient(45deg,#fff 0 4px,#ddd 4px 8px)',
                }))}
                onChange={(id) => setP({ top: id })}
              />
              <span className="sub">{nameOf(lang, TOPS.find((x) => x.id === p.top) ?? TOPS[0])}</span>
            </Row>
          )}
          {it.type === 'wall' && <Toggle checked={!!p.led} onChange={(v) => setP({ led: v })} label={t('led')} />}
        </>
      )}

      {it.type === 'pendant' && (
        <>
          <Row label={t('shade')}>
            <Segmented<ShadeStyle>
              value={p.shade}
              options={[
                { v: 'dome', label: t('dome') },
                { v: 'globe', label: t('globe') },
                { v: 'cylinder', label: t('cylinder') },
              ]}
              onChange={(v) => setP({ shade: v })}
            />
          </Row>
          <Row label={t('metal')}>
            <Swatches value={p.metal} options={METALS.map((m) => ({ id: m.id, label: nameOf(lang, m), color: m.color }))} onChange={(id) => setP({ metal: id })} />
          </Row>
        </>
      )}
      {isLight && (
        <>
          <Row label={t('temp')}>
            <Segmented<number>
              value={p.temp}
              options={[
                { v: 2700, label: '2700K' },
                { v: 4000, label: '4000K' },
                { v: 6000, label: '6000K' },
              ]}
              onChange={(v) => setP({ temp: v })}
            />
          </Row>
          <Toggle checked={p.on !== false} onChange={(v) => setP({ on: v })} label={t('on')} />
        </>
      )}

      {it.type === 'curtain' && (
        <>
          <Row label={t('fabric')}>
            <Swatches value={p.fabric} options={FABRICS.map((f) => ({ id: f.id, label: nameOf(lang, f), color: f.color }))} onChange={(id) => setP({ fabric: id })} />
          </Row>
          <SizeField
            label={t('openRatio')}
            value={p.open ?? 0.3}
            min={0}
            max={1}
            step={0.01}
            unit="%"
            scale={100}
            onChange={(v) =>
              update((d) => {
                const x = d.items.find((i) => i.id === it.id);
                if (x) x.p.open = v;
              }, false)
            }
          />
          <Toggle checked={!!p.sheer} onChange={(v) => setP({ sheer: v })} label={t('sheer')} />
          <Row label={t('metal')}>
            <Swatches value={p.metal} options={METALS.map((m) => ({ id: m.id, label: nameOf(lang, m), color: m.color }))} onChange={(id) => setP({ metal: id })} />
          </Row>
        </>
      )}
      {(it.type === 'fridge' || it.type === 'hood') && (
        <Row label={t('metal')}>
          <Swatches value={p.metal} options={METALS.map((m) => ({ id: m.id, label: nameOf(lang, m), color: m.color }))} onChange={(id) => setP({ metal: id })} />
        </Row>
      )}
      {(it.type === 'bed' || it.type === 'sofa' || it.type === 'dining' || it.type === 'rug') && (
        <Row label={it.type === 'dining' ? t('seat') : t('fabric')}>
          <Swatches value={p.fabric} options={FABRICS.map((f) => ({ id: f.id, label: nameOf(lang, f), color: f.color }))} onChange={(id) => setP({ fabric: id })} />
        </Row>
      )}
      {(it.type === 'bed' || it.type === 'dining' || it.type === 'door') && (
        <Row label={it.type === 'door' ? t('finish') : t('wood')}>
          <Swatches
            value={p.finish}
            options={FINISHES.map((f) => ({ id: f.id, label: nameOf(lang, f), color: f.color, image: f.tex ? texThumb(f.tex) : undefined }))}
            onChange={(id) => setP({ finish: id, color: undefined })}
          />
        </Row>
      )}
      {it.type === 'bed' && <Toggle checked={!!p.nightstands} onChange={(v) => setP({ nightstands: v })} label={t('nightstands')} />}
      {it.type === 'dining' && (
        <Row label={t('chairs')}>
          <Segmented<number> value={p.chairs} options={[2, 4, 6, 8].map((n) => ({ v: n, label: String(n) }))} onChange={(v) => setP({ chairs: v })} />
        </Row>
      )}
      {(it.type === 'sofa' || it.type === 'dining') && (
        <Row label={t('legs')}>
          <Swatches value={p.metal} options={METALS.map((m) => ({ id: m.id, label: nameOf(lang, m), color: m.color }))} onChange={(id) => setP({ metal: id })} />
        </Row>
      )}
      {it.type === 'tv' && <Toggle checked={p.on !== false} onChange={(v) => setP({ on: v })} label={t('screenOn')} />}
      {it.type === 'door' && (
        <>
          <Row label={t('style')}>
            <Segmented<DoorStyle>
              value={p.style}
              options={[
                { v: 'flat', label: t('flat') },
                { v: 'shaker', label: t('shaker') },
              ]}
              onChange={(v) => setP({ style: v })}
            />
          </Row>
          <Row label={t('handle')}>
            <Swatches value={p.metal} options={METALS.map((m) => ({ id: m.id, label: nameOf(lang, m), color: m.color }))} onChange={(id) => setP({ metal: id })} />
          </Row>
          <SizeField
            label={t('doorOpen')}
            value={p.open ?? 0}
            min={0}
            max={1}
            step={0.01}
            unit="%"
            scale={100}
            onChange={(v) =>
              update((d) => {
                const x = d.items.find((i) => i.id === it.id);
                if (x) x.p.open = v;
              }, false)
            }
          />
        </>
      )}
      {it.type === 'model' && <p className="hint">{p.modelName} · {t('clientOwn')}</p>}
      {it.type === 'window' && (
        <Row label={t('frame')}>
          <Swatches value={p.metal} options={METALS.map((m) => ({ id: m.id, label: nameOf(lang, m), color: m.color }))} onChange={(id) => setP({ metal: id })} />
        </Row>
      )}

      <div className="insp-actions">
        {it.wall === null && !isLight && (
          <button type="button" className="btn" onClick={() => update((d) => void d.items.filter((i) => i.id === it.id).forEach((x) => (x.rot += Math.PI / 2)))}>
            ⟳ {t('rotate')}
          </button>
        )}
        <button type="button" className="btn" onClick={duplicateSelected}>
          ⧉ {t('duplicate')}
        </button>
        <button type="button" className="btn danger" onClick={removeSelected}>
          ✕ {t('remove')}
        </button>
      </div>
    </section>
  );
}
