import type { ItemType } from '../types';

const S = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

export function ModuleIcon({ type }: { type: ItemType }) {
  switch (type) {
    case 'base':
      return (
        <svg viewBox="0 0 40 40" {...S}>
          <rect x="6" y="14" width="28" height="20" rx="1.5" />
          <path d="M5 14h30M20 14v20M14 19h3M23 19h3M8 34v2M32 34v2" />
        </svg>
      );
    case 'wall':
      return (
        <svg viewBox="0 0 40 40" {...S}>
          <path d="M4 6h32" />
          <rect x="7" y="6" width="26" height="15" rx="1.5" />
          <path d="M20 6v15M15 18h3M22 18h3M9 24h22" strokeDasharray="2 2" />
        </svg>
      );
    case 'tall':
      return (
        <svg viewBox="0 0 40 40" {...S}>
          <rect x="12" y="3" width="16" height="33" rx="1.5" />
          <path d="M12 16h16M24 10v4M24 19v4" />
        </svg>
      );
    case 'wardrobe':
      return (
        <svg viewBox="0 0 40 40" {...S}>
          <rect x="5" y="4" width="30" height="32" rx="1.5" />
          <path d="M15 4v32M25 4v32M13 18v4M17 18v4M23 18v4" />
        </svg>
      );
    case 'pendant':
      return (
        <svg viewBox="0 0 40 40" {...S}>
          <path d="M20 3v14M9 27a11 10 0 0 1 22 0z" />
          <path d="M17 31a3 3 0 0 0 6 0" />
        </svg>
      );
    case 'ceiling':
      return (
        <svg viewBox="0 0 40 40" {...S}>
          <path d="M4 10h32" />
          <path d="M8 10q12 12 24 0" />
          <path d="M13 24l-2 4M20 26v4M27 24l2 4" />
        </svg>
      );
    case 'curtain':
      return (
        <svg viewBox="0 0 40 40" {...S}>
          <path d="M4 6h32" />
          <path d="M7 6c2 10-2 20 3 30M11 6c1 10-1 20 3 30M29 6c-1 10 1 20-3 30M33 6c-2 10 2 20-3 30" />
        </svg>
      );
    case 'window':
      return (
        <svg viewBox="0 0 40 40" {...S}>
          <rect x="7" y="6" width="26" height="26" rx="1" />
          <path d="M20 6v26M7 19h26M5 34h30" />
        </svg>
      );
  }
}
