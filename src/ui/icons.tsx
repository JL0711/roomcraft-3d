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
    case 'fridge':
      return (
        <svg viewBox="0 0 40 40" {...S}>
          <rect x="10" y="3" width="20" height="34" rx="2" />
          <path d="M10 24h20M20 3v21M17 10v8M23 10v8M17 29h6" />
        </svg>
      );
    case 'hood':
      return (
        <svg viewBox="0 0 40 40" {...S}>
          <path d="M16 3v12M24 3v12M16 15l-10 9h28l-10-9M6 24v4h28v-4" />
        </svg>
      );
    case 'bed':
      return (
        <svg viewBox="0 0 40 40" {...S}>
          <path d="M6 30V10M34 30V20M6 22h28M6 26h28" />
          <rect x="9" y="16" width="8" height="5" rx="2" />
          <path d="M6 30v3M34 30v3" />
        </svg>
      );
    case 'sofa':
      return (
        <svg viewBox="0 0 40 40" {...S}>
          <path d="M9 22v-7a3 3 0 0 1 3-3h16a3 3 0 0 1 3 3v7" />
          <path d="M5 20h5v6h20v-6h5v9H5z" />
          <path d="M8 29v3M32 29v3" />
        </svg>
      );
    case 'dining':
      return (
        <svg viewBox="0 0 40 40" {...S}>
          <path d="M8 18h24M12 18v14M28 18v14" />
          <path d="M5 12v20M5 24h4M35 12v20M35 24h-4" />
        </svg>
      );
    case 'rug':
      return (
        <svg viewBox="0 0 40 40" {...S}>
          <path d="M8 12h24l4 16H4z" />
          <path d="M11 16h18l2 8H9z" strokeDasharray="2 2" />
        </svg>
      );
    case 'plant':
      return (
        <svg viewBox="0 0 40 40" {...S}>
          <path d="M13 26h14l-2 10H15zM20 26V14M20 18c-6 0-9-4-9-9 5 0 9 3 9 9zM20 15c0-5 4-9 9-9 0 6-4 9-9 9z" />
        </svg>
      );
    case 'tv':
      return (
        <svg viewBox="0 0 40 40" {...S}>
          <rect x="4" y="8" width="32" height="20" rx="1.5" />
          <path d="M15 33h10M20 28v5" />
        </svg>
      );
    case 'door':
      return (
        <svg viewBox="0 0 40 40" {...S}>
          <path d="M9 36V4h22v32M5 36h30" />
          <path d="M9 4l12 4v28" />
          <circle cx="18" cy="21" r="1" />
        </svg>
      );
    case 'model':
      return (
        <svg viewBox="0 0 40 40" {...S}>
          <path d="M20 4 34 12v16L20 36 6 28V12z" />
          <path d="M6 12l14 8 14-8M20 20v16" />
        </svg>
      );
  }
}
