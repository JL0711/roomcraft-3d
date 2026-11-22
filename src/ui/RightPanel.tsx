import { useMemo } from 'react';
import { quotePDF } from '../actions';
import { useT } from '../i18n';
import { buildQuote, money } from '../quote';
import { useStore } from '../store';
import { Inspector } from './Inspector';

function QuotePanel() {
  const t = useT();
  const lang = useStore((s) => s.lang);
  const design = useStore((s) => s.design);
  const selected = useStore((s) => s.selected);
  const busy = useStore((s) => s.busy);
  const { update, checkpoint, select } = useStore.getState();
  const q = useMemo(() => buildQuote(design, lang), [design, lang]);

  return (
    <section className="quote">
      <h2>{t('quote')}</h2>
      <div className="meta-fields">
        <label>
          <span>{t('client')}</span>
          <input
            value={design.meta.client}
            placeholder={t('clientPh')}
            onFocus={() => checkpoint()}
            onChange={(e) => update((d) => void (d.meta.client = e.target.value), false)}
          />
        </label>
        <label>
          <span>{t('address')}</span>
          <input
            value={design.meta.address}
            placeholder={t('addressPh')}
            onFocus={() => checkpoint()}
            onChange={(e) => update((d) => void (d.meta.address = e.target.value), false)}
          />
        </label>
      </div>
      <ul className="quote-lines">
        {q.lines.map((l, i) => (
          <li key={i} className={l.itemId && l.itemId === selected ? 'on' : ''} onClick={() => l.itemId && select(l.itemId)}>
            <div className="ql-main">
              <span className="ql-name">{l.name}</span>
              <span className="ql-amt">{money(l.amount)}</span>
            </div>
            <div className="ql-spec">
              {l.qty !== 1 || l.unit !== t('pcs') ? `${l.qty} ${l.unit} × ${money(l.price)} · ` : ''}
              {l.spec}
            </div>
          </li>
        ))}
      </ul>
      <dl className="totals">
        <dt>{t('install')}</dt>
        <dd>{money(q.install)}</dd>
        <dt>{t('subtotal')}</dt>
        <dd>{money(q.subtotal)}</dd>
        <dt>{t('gst')}</dt>
        <dd>{money(q.gst)}</dd>
        <dt className="grand">{t('total')}</dt>
        <dd className="grand">{money(q.total)}</dd>
      </dl>
      <button type="button" className="btn primary block" disabled={busy} onClick={() => quotePDF()}>
        ⤓ {t('quotePdf')}
      </button>
      <p className="hint small">{t('demoPrice')}</p>
    </section>
  );
}

export function RightPanel() {
  return (
    <aside className="panel right">
      <Inspector />
      <QuotePanel />
    </aside>
  );
}
