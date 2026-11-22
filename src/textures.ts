import * as THREE from 'three';

/**
 * All surface textures are generated procedurally on a canvas, so the demo
 * ships without any image assets. UVs are in metres (see boxGeo in
 * geometry.ts), and each texture's repeat is 1 / (metres covered per tile).
 */
export type TexKind =
  | 'oak'
  | 'walnut'
  | 'plank'
  | 'tile'
  | 'terrazzo'
  | 'concrete'
  | 'quartz'
  | 'marble'
  | 'granite'
  | 'subway'
  | 'zellige';

export const TEX_SIZE: Record<TexKind, number> = {
  oak: 0.6,
  walnut: 0.6,
  plank: 1.2,
  tile: 0.6,
  terrazzo: 0.5,
  concrete: 1.2,
  quartz: 0.5,
  marble: 1.0,
  granite: 0.4,
  subway: 0.3,
  zellige: 0.3,
};

function rand(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 1000000) / 1000000;
  };
}

function makeCanvas(w: number, h = w) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!] as const;
}

function shade(hex: string, k: number) {
  const c = new THREE.Color(hex);
  const f = (v: number) => Math.round(Math.min(1, Math.max(0, v * k)) * 255);
  return `rgb(${f(c.r)},${f(c.g)},${f(c.b)})`;
}

/** Draws wood grain into a rectangle. Grain runs along v (vertical) or u. */
function grain(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  w: number,
  h: number,
  base: string,
  line: string,
  r: () => number,
  vertical: boolean,
  count: number,
) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, y0, w, h);
  ctx.clip();
  ctx.fillStyle = base;
  ctx.fillRect(x0, y0, w, h);
  const across = vertical ? w : h;
  const along = vertical ? h : w;
  for (let i = 0; i < 16; i++) {
    const p = r() * across;
    const bw = 8 + r() * across * 0.12;
    ctx.fillStyle = r() < 0.5 ? `rgba(0,0,0,${0.025 + r() * 0.05})` : `rgba(255,255,255,${0.02 + r() * 0.05})`;
    if (vertical) ctx.fillRect(x0 + p, y0, bw, h);
    else ctx.fillRect(x0, y0 + p, w, bw);
  }
  ctx.strokeStyle = line;
  for (let i = 0; i < count; i++) {
    const p = r() * across;
    const amp = 1.5 + r() * 7;
    const k = ((1 + Math.floor(r() * 3)) * Math.PI * 2) / along;
    const ph = r() * 6.283;
    ctx.globalAlpha = 0.06 + r() * 0.28;
    ctx.lineWidth = 0.5 + r() * 1.8;
    ctx.beginPath();
    for (let s = 0; s <= along; s += 5) {
      const off = Math.sin(s * k + ph) * amp + Math.sin(s * k * 3 + ph * 2) * amp * 0.25;
      const X = vertical ? x0 + p + off : x0 + s;
      const Y = vertical ? y0 + s : y0 + p + off;
      if (s === 0) ctx.moveTo(X, Y);
      else ctx.lineTo(X, Y);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

function speckle(
  ctx: CanvasRenderingContext2D,
  N: number,
  count: number,
  colors: string[],
  rMin: number,
  rMax: number,
  aMin: number,
  aMax: number,
  r: () => number,
) {
  for (let i = 0; i < count; i++) {
    const x = r() * N;
    const y = r() * N;
    const rad = rMin + r() * (rMax - rMin);
    ctx.globalAlpha = aMin + r() * (aMax - aMin);
    ctx.fillStyle = colors[Math.floor(r() * colors.length)];
    for (const dx of [0, x < rad ? N : x > N - rad ? -N : 0]) {
      for (const dy of [0, y < rad ? N : y > N - rad ? -N : 0]) {
        ctx.beginPath();
        ctx.arc(x + dx, y + dy, rad, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.globalAlpha = 1;
}

function draw(kind: TexKind): HTMLCanvasElement {
  const N = kind === 'plank' || kind === 'marble' ? 1024 : 512;
  const [c, ctx] = makeCanvas(N);
  const r = rand(kind.length * 7919 + kind.charCodeAt(0) * 31);
  switch (kind) {
    case 'oak':
      grain(ctx, 0, 0, N, N, '#c9a77c', 'rgba(110,72,38,1)', r, true, 150);
      break;
    case 'walnut':
      grain(ctx, 0, 0, N, N, '#6e4b33', 'rgba(35,20,10,1)', r, true, 150);
      break;
    case 'plank': {
      const rows = 6;
      const rh = N / rows;
      for (let row = 0; row < rows; row++) {
        const a = r() * N;
        const b = a + N * (0.42 + r() * 0.2);
        const boards: [number, number][] = [
          [a, b],
          [b, a + N],
        ];
        for (const [s, e] of boards) {
          const base = shade('#c9a273', 0.92 + r() * 0.16);
          const seed = Math.floor(r() * 1e9);
          for (const shift of [0, -N]) grain(ctx, s + shift, row * rh, e - s, rh, base, 'rgba(120,78,40,1)', rand(seed), false, 18);
        }
        ctx.fillStyle = 'rgba(60,38,20,0.45)';
        ctx.fillRect(0, row * rh, N, 2);
        for (const s of [a, b]) {
          ctx.fillRect(s % N, row * rh, 2, rh);
        }
      }
      break;
    }
    case 'tile': {
      ctx.fillStyle = '#c7c4be';
      ctx.fillRect(0, 0, N, N);
      speckle(ctx, N, 2500, ['#b5b1aa', '#d6d3ce', '#a9a59e'], 0.6, 1.8, 0.15, 0.4, r);
      ctx.fillStyle = '#97938b';
      ctx.fillRect(0, 0, N, 3);
      ctx.fillRect(0, 0, 3, N);
      break;
    }
    case 'terrazzo': {
      ctx.fillStyle = '#e4ddd2';
      ctx.fillRect(0, 0, N, N);
      speckle(ctx, N, 1200, ['#cfc6ba', '#b9b2a8'], 0.6, 1.6, 0.25, 0.5, r);
      speckle(ctx, N, 260, ['#b39f8a', '#7d898e', '#c98f6f', '#4a4f54', '#f6f2ea', '#a7b49c'], 3.5, 11, 0.85, 1, r);
      break;
    }
    case 'concrete': {
      ctx.fillStyle = '#b9b5ae';
      ctx.fillRect(0, 0, N, N);
      for (let i = 0; i < 260; i++) {
        const x = r() * N;
        const y = r() * N;
        const rad = 20 + r() * 90;
        const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
        const dark = r() < 0.5;
        g.addColorStop(0, dark ? 'rgba(80,76,70,0.07)' : 'rgba(255,255,255,0.07)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
      }
      speckle(ctx, N, 5000, ['#a29e97', '#cfccc6'], 0.3, 1, 0.2, 0.5, r);
      break;
    }
    case 'quartz': {
      ctx.fillStyle = '#f1f0ed';
      ctx.fillRect(0, 0, N, N);
      speckle(ctx, N, 6000, ['#c9c7c2', '#a9a7a3', '#dedcd8'], 0.4, 1.4, 0.2, 0.55, r);
      break;
    }
    case 'granite': {
      ctx.fillStyle = '#222224';
      ctx.fillRect(0, 0, N, N);
      speckle(ctx, N, 5000, ['#59585a', '#8b8a8c', '#3a3533', '#c9c7c5'], 0.4, 1.8, 0.35, 0.9, r);
      break;
    }
    case 'subway':
    case 'zellige': {
      const zel = kind === 'zellige';
      ctx.fillStyle = zel ? '#c9cfc6' : '#d6d2ca';
      ctx.fillRect(0, 0, N, N);
      const cols = zel ? 3 : 2;
      const rows = zel ? 3 : 4;
      const tw = N / cols;
      const th = N / rows;
      const g = 3;
      for (let row = 0; row < rows; row++) {
        const off = !zel && row % 2 ? tw / 2 : 0;
        for (let c = -1; c <= cols; c++) {
          const x = c * tw + off;
          const tone = zel ? 0.78 + r() * 0.34 : 0.97 + r() * 0.05;
          const base = zel ? '#4f7d6c' : '#f4f2ed';
          const grd = ctx.createLinearGradient(x, row * th, x + tw, row * th + th);
          grd.addColorStop(0, shade(base, tone * 1.04));
          grd.addColorStop(1, shade(base, tone * (zel ? 0.9 : 0.98)));
          ctx.fillStyle = grd;
          ctx.fillRect(x + g / 2, row * th + g / 2, tw - g, th - g);
        }
      }
      break;
    }
    case 'marble': {
      ctx.fillStyle = '#f2f1ee';
      ctx.fillRect(0, 0, N, N);
      for (let v = 0; v < 9; v++) {
        let x = r() * N;
        let y = r() * N;
        let a = r() * Math.PI * 2;
        const width = 0.6 + r() * 2.6;
        const alpha = 0.12 + r() * 0.28;
        const pts: [number, number][] = [];
        for (let s = 0; s < 420; s++) {
          a += (r() - 0.5) * 0.32;
          x += Math.cos(a) * 4;
          y += Math.sin(a) * 4;
          pts.push([x, y]);
        }
        for (const pass of [0, 1]) {
          ctx.save();
          if (pass === 0) ctx.filter = 'blur(3px)';
          ctx.strokeStyle = `rgba(105,105,112,${pass === 0 ? alpha * 0.6 : alpha})`;
          ctx.lineWidth = pass === 0 ? width * 3 : width;
          ctx.beginPath();
          pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
          ctx.stroke();
          ctx.restore();
        }
      }
      break;
    }
  }
  return c;
}

const texCache = new Map<string, THREE.Texture>();

export function getTexture(kind: TexKind): THREE.Texture {
  let t = texCache.get(kind);
  if (!t) {
    t = new THREE.CanvasTexture(draw(kind));
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    const s = TEX_SIZE[kind];
    t.repeat.set(1 / s, 1 / s);
    texCache.set(kind, t);
  }
  return t;
}

/** Normal map for fluted (reeded) door fronts: one flute every 3 cm. */
export function fluteNormal(): THREE.Texture {
  let t = texCache.get('flute');
  if (!t) {
    const W = 128;
    const [c, ctx] = makeCanvas(W, 4);
    const img = ctx.createImageData(W, 4);
    for (let x = 0; x < W; x++) {
      const ph = ((x + 0.5) / W) * Math.PI * 2;
      const nx = -Math.sin(ph) * 0.8;
      const nz = Math.sqrt(1 - nx * nx);
      for (let y = 0; y < 4; y++) {
        const i = (y * W + x) * 4;
        img.data[i] = (nx * 0.5 + 0.5) * 255;
        img.data[i + 1] = 128;
        img.data[i + 2] = (nz * 0.5 + 0.5) * 255;
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.NoColorSpace;
    t.repeat.set(1 / 0.03, 1);
    texCache.set('flute', t);
  }
  return t;
}

/** View through a window: a simple sky and skyline, day or night. */
export function skyTexture(night: boolean): THREE.Texture {
  const key = night ? 'sky-night' : 'sky-day';
  let t = texCache.get(key);
  if (!t) {
    const [c, ctx] = makeCanvas(512);
    const g = ctx.createLinearGradient(0, 0, 0, 512);
    if (night) {
      g.addColorStop(0, '#0b1430');
      g.addColorStop(1, '#2b3a63');
    } else {
      g.addColorStop(0, '#8fbfe9');
      g.addColorStop(0.75, '#dcebf7');
      g.addColorStop(1, '#eef4f8');
    }
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 512, 512);
    const r = rand(night ? 99 : 42);
    let x = 0;
    while (x < 512) {
      const bw = 30 + r() * 60;
      const bh = 60 + r() * 170;
      ctx.fillStyle = night ? '#141b2e' : `rgba(150,165,180,${0.55 + r() * 0.3})`;
      ctx.fillRect(x, 512 - bh, bw, bh);
      if (night) {
        for (let wy = 512 - bh + 8; wy < 505; wy += 12) {
          for (let wx = x + 5; wx < x + bw - 6; wx += 9) {
            if (r() < 0.35) {
              ctx.fillStyle = r() < 0.7 ? '#ffd58a' : '#cfe3ff';
              ctx.fillRect(wx, wy, 4, 5);
            }
          }
        }
      }
      x += bw + 4 + r() * 14;
    }
    t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    texCache.set(key, t);
  }
  return t;
}

/** Black-glass induction hob with four cooking zones. */
export function hobTexture(): THREE.Texture {
  let t = texCache.get('hob');
  if (!t) {
    const [c, ctx] = makeCanvas(512, 440);
    ctx.fillStyle = '#0c0c0d';
    ctx.fillRect(0, 0, 512, 440);
    ctx.strokeStyle = 'rgba(200,200,205,0.55)';
    const zones: [number, number, number][] = [
      [140, 130, 92],
      [380, 120, 70],
      [140, 320, 70],
      [370, 300, 100],
    ];
    for (const [x, y, rad] of zones) {
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, rad, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, y, rad * 0.72, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(230,230,235,0.6)';
    for (let i = 0; i < 6; i++) ctx.fillRect(160 + i * 34, 412, 18, 4);
    t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    texCache.set('hob', t);
  }
  return t;
}

/** A rug: wool texture in the fabric colour with a contrasting border. */
export function rugTexture(color: string): THREE.Texture {
  const key = `rug:${color}`;
  let t = texCache.get(key);
  if (!t) {
    const [c, ctx] = makeCanvas(512);
    const r = rand(color.length * 97 + color.charCodeAt(1));
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 512, 512);
    speckle(ctx, 512, 7000, [shade(color, 0.94), shade(color, 1.05), shade(color, 0.98)], 0.5, 1.3, 0.25, 0.6, r);
    ctx.strokeStyle = shade(color, 0.78);
    ctx.lineWidth = 10;
    ctx.strokeRect(34, 34, 444, 444);
    ctx.lineWidth = 3;
    ctx.strokeRect(58, 58, 396, 396);
    t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    texCache.set(key, t);
  }
  return t;
}

/** Picture shown on the TV: a soft landscape at dusk. */
export function screenTexture(): THREE.Texture {
  let t = texCache.get('screen');
  if (!t) {
    const [c, ctx] = makeCanvas(512, 288);
    const g = ctx.createLinearGradient(0, 0, 0, 288);
    g.addColorStop(0, '#24345e');
    g.addColorStop(0.55, '#e9927a');
    g.addColorStop(1, '#f6d2a2');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 512, 288);
    ctx.fillStyle = 'rgba(255,236,200,0.9)';
    ctx.beginPath();
    ctx.arc(330, 170, 26, 0, Math.PI * 2);
    ctx.fill();
    const hills: [string, number, number][] = [
      ['#5b4a6b', 180, 0.012],
      ['#3e3452', 215, 0.018],
      ['#2a2438', 245, 0.026],
    ];
    for (const [col, base, f] of hills) {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(0, 288);
      for (let x = 0; x <= 512; x += 8) ctx.lineTo(x, base - Math.sin(x * f + base) * 18 - Math.sin(x * f * 2.3) * 8);
      ctx.lineTo(512, 288);
      ctx.fill();
    }
    t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    texCache.set('screen', t);
  }
  return t;
}
