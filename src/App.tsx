import { useEffect } from 'react';
import { glb, hdRender, openDesign, panorama, saveDesign } from './actions';
import { downloadURL } from './capture';
import { useT } from './i18n';
import Viewport from './scene/Viewport';
import { useStore, type View } from './store';
import { LeftPanel } from './ui/LeftPanel';
import { PlanEditor } from './ui/PlanEditor';
import { RightPanel } from './ui/RightPanel';

function Toolbar() {
  const t = useT();
  const view = useStore((s) => s.view);
  const lang = useStore((s) => s.lang);
  const busy = useStore((s) => s.busy);
  const canUndo = useStore((s) => s.past.length > 0);
  const canRedo = useStore((s) => s.future.length > 0);
  const { setView, setLang, undo, redo } = useStore.getState();
  const views: { v: View; label: string }[] = [
    { v: '3d', label: t('view3d') },
    { v: 'plan', label: t('viewPlan') },
    { v: 'pano', label: t('viewPano') },
  ];
  return (
    <header className="toolbar">
      <div className="brand">
        <span className="logo" aria-hidden>
          <svg viewBox="0 0 32 32">
            <path d="M4 12 16 4l12 8v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" fill="currentColor" opacity=".18" />
            <path d="M4 12 16 4l12 8M8 28V15h16v13M8 20h16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          </svg>
        </span>
        <div>
          <strong>RoomCraft 3D</strong>
          <span>{t('appSub')}</span>
        </div>
      </div>
      <nav className="segmented views" aria-label="view">
        {views.map((x) => (
          <button key={x.v} type="button" className={view === x.v ? 'on' : ''} onClick={() => setView(x.v)}>
            {x.label}
          </button>
        ))}
      </nav>
      <div className="tools">
        <button type="button" className="btn ghost icon" title={t('undo')} aria-label={t('undo')} disabled={!canUndo} onClick={undo}>
          ↶
        </button>
        <button type="button" className="btn ghost icon" title={t('redo')} aria-label={t('redo')} disabled={!canRedo} onClick={redo}>
          ↷
        </button>
        <span className="sep" />
        <button type="button" className="btn" disabled={busy} onClick={() => hdRender()}>
          {t('hdRender')}
        </button>
        <button type="button" className="btn" disabled={busy} onClick={() => panorama()}>
          {t('panoExport')}
        </button>
        <button type="button" className="btn" disabled={busy} onClick={() => glb()}>
          {t('glb')}
        </button>
        <span className="sep" />
        <button type="button" className="btn ghost" onClick={saveDesign}>
          {t('save')}
        </button>
        <button type="button" className="btn ghost" onClick={openDesign}>
          {t('open')}
        </button>
        <button type="button" className="btn ghost lang" onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}>
          {t('langBtn')}
        </button>
      </div>
    </header>
  );
}

function ResultModal() {
  const t = useT();
  const modal = useStore((s) => s.modal);
  const setModal = useStore((s) => s.setModal);
  if (!modal) return null;
  const isPano = modal.kind === 'pano';
  return (
    <div className="modal-back" onClick={() => setModal(null)}>
      <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{isPano ? t('panoTitle') : t('hdTitle')}</h2>
          <button type="button" className="btn ghost icon" aria-label={t('close')} onClick={() => setModal(null)}>
            ✕
          </button>
        </div>
        <img src={modal.url} alt={isPano ? t('panoTitle') : t('hdTitle')} className={isPano ? 'pano-img' : ''} />
        <div className="modal-foot">
          <span className="hint">{isPano ? t('panoNote') : t('hdNote')}</span>
          <button type="button" className="btn primary" onClick={() => downloadURL(modal.url, isPano ? 'roomcraft-360.jpg' : 'roomcraft-render.jpg')}>
            ⤓ {t('download')}
          </button>
        </div>
      </div>
    </div>
  );
}

function StageOverlay() {
  const t = useT();
  const view = useStore((s) => s.view);
  const busy = useStore((s) => s.busy);
  const resetCamera = useStore((s) => s.resetCamera);
  return (
    <>
      {view === 'plan' && <PlanEditor />}
      {view === 'pano' && <div className="stage-hint">{t('panoHint')}</div>}
      {view === '3d' && (
        <button type="button" className="btn floating" onClick={resetCamera}>
          ⌖ {t('resetView')}
        </button>
      )}
      <span className="badge">{t('demoBadge')}</span>
      {busy && (
        <div className="busy">
          <span className="spinner" />
          {t('rendering')}
        </div>
      )}
    </>
  );
}

export default function App() {
  const lang = useStore((s) => s.lang);
  useEffect(() => {
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
    document.title = lang === 'zh' ? 'RoomCraft 3D · 室内装修设计演示' : 'RoomCraft 3D · Interior design demo';
  }, [lang]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return;
      const s = useStore.getState();
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) s.redo();
        else s.undo();
      } else if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        s.redo();
      } else if (mod && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        s.duplicateSelected();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (s.selected) {
          e.preventDefault();
          s.removeSelected();
        }
      } else if (e.key === 'Escape') {
        if (s.modal) s.setModal(null);
        else if (s.view === 'pano') s.setView('3d');
        else s.select(null);
      } else if (e.key.toLowerCase() === 'r' && !mod && s.selected) {
        const it = s.design.items.find((i) => i.id === s.selected);
        if (it && it.wall === null && it.type !== 'pendant' && it.type !== 'ceiling') s.update((d) => void d.items.filter((i) => i.id === it.id).forEach((x) => (x.rot += Math.PI / 2)));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="app">
      <Toolbar />
      <main className="main">
        <LeftPanel />
        <section className="stage">
          <Viewport />
          <StageOverlay />
        </section>
        <RightPanel />
      </main>
      <ResultModal />
    </div>
  );
}
