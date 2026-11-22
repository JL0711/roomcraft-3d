import { jsPDF } from 'jspdf';
import { tr } from './i18n';
import { buildQuote, money } from './quote';
import { PRESETS } from './layout';
import type { Design, Lang } from './types';

/**
 * The quotation is laid out on A4-sized canvases and placed into the PDF as
 * images. That keeps Chinese text correct without embedding a CJK font.
 */
const W = 1654;
const H = 2339;
const M = 110;
const FONT = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans SC","Noto Sans CJK SC",system-ui,sans-serif';
const font = (size: number, weight = 400) => `${weight} ${size}px ${FONT}`;
const INK = '#1f2328';
const MUTED = '#6b6f76';
const LINE = '#e3e0db';
const ACCENT = '#c4622d';

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = rej;
    im.src = src;
  });
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number, maxLines: number) {
  const lines: string[] = [];
  let cur = '';
  // break between CJK characters, or at spaces for Latin text
  const tokens = text.match(/[　-鿿＀-￯]|[^\s　-鿿＀-￯]+\s*|\s+/g) ?? [text];
  for (const tok of tokens) {
    if (ctx.measureText(cur + tok).width > maxW && cur) {
      lines.push(cur.trimEnd());
      cur = tok.trimStart();
      if (lines.length === maxLines) break;
    } else cur += tok;
  }
  if (lines.length < maxLines && cur) lines.push(cur.trimEnd());
  if (lines.length === maxLines && ctx.measureText(lines[maxLines - 1]).width > maxW) {
    let s = lines[maxLines - 1];
    while (s && ctx.measureText(s + '…').width > maxW) s = s.slice(0, -1);
    lines[maxLines - 1] = s + '…';
  }
  return lines;
}

export function quoteNumber(d: Design) {
  const now = new Date();
  const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  let h = 0;
  for (const c of JSON.stringify(d.items)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return `Q-${ymd}-${(h % 10000).toString().padStart(4, '0')}`;
}

export async function exportQuotePDF(d: Design, lang: Lang, shot: string) {
  const { pages, no, title } = await renderQuotePages(d, lang, shot);
  const pdf = new jsPDF({ unit: 'pt', format: 'a4', compress: true });
  pages.forEach((c, i) => {
    if (i) pdf.addPage();
    pdf.addImage(c.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, 595.28, 841.89);
  });
  pdf.setProperties({ title, creator: 'RoomCraft 3D demo' });
  pdf.save(`${no}.pdf`);
  return no;
}

/** Lays the quotation out as A4 page canvases (also used for previews). */
export async function renderQuotePages(d: Design, lang: Lang, shot: string) {
  const t = (k: Parameters<typeof tr>[1]) => tr(lang, k);
  const q = buildQuote(d, lang);
  const no = quoteNumber(d);
  const date = new Date().toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-SG', { year: 'numeric', month: 'long', day: 'numeric' });
  const pages: HTMLCanvasElement[] = [];
  const newPage = () => {
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = ACCENT;
    ctx.fillRect(0, 0, W, 14);
    pages.push(c);
    return ctx;
  };

  let ctx = newPage();
  let y = M;
  // header
  ctx.fillStyle = INK;
  ctx.font = font(60, 700);
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(t('quoteTitle'), M, y + 48);
  ctx.font = font(26);
  ctx.fillStyle = MUTED;
  ctx.fillText(`RoomCraft 3D · ${t('demoBadge')}`, M, y + 96);
  ctx.textAlign = 'right';
  ctx.fillStyle = INK;
  ctx.font = font(26, 600);
  ctx.fillText(`${t('quoteNo')}  ${no}`, W - M, y + 30);
  ctx.font = font(26);
  ctx.fillStyle = MUTED;
  ctx.fillText(`${t('date')}  ${date}`, W - M, y + 70);
  ctx.fillText(t('validity'), W - M, y + 108);
  ctx.textAlign = 'left';
  y += 150;
  ctx.fillStyle = LINE;
  ctx.fillRect(M, y, W - 2 * M, 2);
  y += 50;

  // project info
  const preset = PRESETS.find((p) => p.roomType === d.roomType);
  const info: [string, string][] = [
    [t('client'), d.meta.client || '—'],
    [t('address'), d.meta.address || '—'],
    [t('project'), `${preset ? t(preset.roomType) : ''} · ${t('floorArea')} ${q.floorArea} ${t('sqm')} · ${t('wallH')} ${Math.round(d.wallH * 1000)} mm`],
  ];
  for (const [k, v] of info) {
    ctx.font = font(26);
    ctx.fillStyle = MUTED;
    ctx.fillText(k, M, y);
    ctx.fillStyle = INK;
    ctx.font = font(28, 500);
    ctx.fillText(v, M + 220, y);
    y += 48;
  }
  y += 16;

  // render of the design
  const img = await loadImage(shot);
  const iw = W - 2 * M;
  const ih = Math.min(760, (iw * img.height) / img.width);
  const srcRatio = iw / ih;
  let sw = img.width;
  let sh = img.width / srcRatio;
  if (sh > img.height) {
    sh = img.height;
    sw = img.height * srcRatio;
  }
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(M, y, iw, ih, 18);
  ctx.clip();
  ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, M, y, iw, ih);
  ctx.restore();
  y += ih + 50;

  // table
  const cols = [
    { k: '#', w: 64, align: 'left' as const },
    { k: t('item'), w: 270, align: 'left' as const },
    { k: t('spec'), w: 560, align: 'left' as const },
    { k: t('qty'), w: 140, align: 'right' as const },
    { k: t('unitPrice'), w: 190, align: 'right' as const },
    { k: t('amount'), w: 210, align: 'right' as const },
  ];
  const colX: number[] = [];
  cols.reduce((x, c) => {
    colX.push(x);
    return x + c.w;
  }, M);
  const header = () => {
    ctx.fillStyle = '#f4f2ef';
    ctx.fillRect(M, y, W - 2 * M, 60);
    ctx.fillStyle = MUTED;
    ctx.font = font(24, 600);
    cols.forEach((c, i) => {
      ctx.textAlign = c.align;
      ctx.fillText(c.k, c.align === 'right' ? colX[i] + c.w - 14 : colX[i] + 14, y + 39);
    });
    ctx.textAlign = 'left';
    y += 60;
  };
  header();
  const bottomLimit = H - M - 120;
  q.lines.forEach((l, idx) => {
    ctx.font = font(22);
    const specLines = wrap(ctx, l.spec, cols[2].w - 28, 2);
    const rh = 34 + specLines.length * 32;
    if (y + rh > bottomLimit) {
      ctx = newPage();
      y = M + 20;
      header();
    }
    ctx.fillStyle = INK;
    ctx.font = font(24);
    ctx.fillText(String(idx + 1), colX[0] + 14, y + 42);
    ctx.font = font(26, 600);
    ctx.fillText(wrap(ctx, l.name, cols[1].w - 28, 1)[0], colX[1] + 14, y + 42);
    ctx.font = font(22);
    ctx.fillStyle = MUTED;
    specLines.forEach((s, i) => ctx.fillText(s, colX[2] + 14, y + 42 + i * 32));
    ctx.fillStyle = INK;
    ctx.font = font(24);
    ctx.textAlign = 'right';
    ctx.fillText(`${l.qty} ${l.unit}`, colX[3] + cols[3].w - 14, y + 42);
    ctx.fillText(money(l.price), colX[4] + cols[4].w - 14, y + 42);
    ctx.font = font(24, 600);
    ctx.fillText(money(l.amount), colX[5] + cols[5].w - 14, y + 42);
    ctx.textAlign = 'left';
    y += rh;
    ctx.fillStyle = LINE;
    ctx.fillRect(M, y, W - 2 * M, 1.5);
  });

  // totals
  const totals: [string, number, boolean][] = [
    [t('install'), q.install, false],
    [t('subtotal'), q.subtotal, false],
    [t('gst'), q.gst, false],
    [t('total'), q.total, true],
  ];
  if (y + 60 * totals.length + 140 > H - M) {
    ctx = newPage();
    y = M + 20;
  }
  y += 30;
  for (const [k, v, strong] of totals) {
    ctx.textAlign = 'right';
    ctx.font = font(strong ? 34 : 26, strong ? 700 : 400);
    ctx.fillStyle = strong ? INK : MUTED;
    ctx.fillText(k, W - M - 300, y + 34);
    ctx.fillStyle = strong ? ACCENT : INK;
    ctx.fillText(money(v), W - M - 14, y + 34);
    y += strong ? 64 : 50;
  }
  ctx.textAlign = 'left';

  // notes and page numbers
  pages.forEach((c, i) => {
    const g = c.getContext('2d')!;
    g.fillStyle = LINE;
    g.fillRect(M, H - M - 70, W - 2 * M, 1.5);
    g.font = font(21);
    g.fillStyle = MUTED;
    g.textAlign = 'left';
    g.fillText(t('pdfNote1'), M, H - M - 30);
    g.fillText(t('pdfNote2'), M, H - M + 4);
    g.textAlign = 'right';
    g.fillText(lang === 'zh' ? `第 ${i + 1} / ${pages.length} 页` : `${t('page')} ${i + 1} / ${pages.length}`, W - M, H - M - 30);
  });

  return { pages, no, title: `${t('quoteTitle')} ${no}` };
}

