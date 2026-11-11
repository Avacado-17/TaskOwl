/**
 * Color Palette and Shade Utility
 * Supports multi-family shade selection, contrast calculation, and dynamic CSS variable injection.
 */

export interface ColorShade {
  shade: number; // 200, 300, 400, 500, 600, 700
  hex: string;
  name: string;
}

export interface ColorFamily {
  id: string;
  name: string;
  shades: ColorShade[];
}

export const COLOR_PALETTE_FAMILIES: ColorFamily[] = [
  {
    id: 'cyan',
    name: 'Sky & Cyan',
    shades: [
      { shade: 200, hex: '#bae6fd', name: 'Sky 200' },
      { shade: 300, hex: '#7dd3fc', name: 'Sky 300' },
      { shade: 400, hex: '#38bdf8', name: 'Sky 400 (Vibrant)' },
      { shade: 500, hex: '#0ea5e9', name: 'Sky 500 (Pure)' },
      { shade: 600, hex: '#0284c7', name: 'Sky 600 (Deep)' },
      { shade: 700, hex: '#0369a1', name: 'Sky 700 (Midnight)' },
    ],
  },
  {
    id: 'emerald',
    name: 'Emerald & Mint',
    shades: [
      { shade: 200, hex: '#a7f3d0', name: 'Mint 200' },
      { shade: 300, hex: '#6ee7b7', name: 'Mint 300' },
      { shade: 400, hex: '#34d399', name: 'Emerald 400 (Neon)' },
      { shade: 500, hex: '#10b981', name: 'Emerald 500 (Pure)' },
      { shade: 600, hex: '#059669', name: 'Emerald 600 (Forest)' },
      { shade: 700, hex: '#047857', name: 'Emerald 700 (Pine)' },
    ],
  },
  {
    id: 'violet',
    name: 'Violet & Purple',
    shades: [
      { shade: 200, hex: '#e9d5ff', name: 'Violet 200' },
      { shade: 300, hex: '#d8b4fe', name: 'Violet 300' },
      { shade: 400, hex: '#c084fc', name: 'Violet 400 (Neon)' },
      { shade: 500, hex: '#a855f7', name: 'Violet 500 (Royal)' },
      { shade: 600, hex: '#9333ea', name: 'Violet 600 (Amethyst)' },
      { shade: 700, hex: '#7e22ce', name: 'Violet 700 (Deep)' },
    ],
  },
  {
    id: 'amber',
    name: 'Amber & Gold',
    shades: [
      { shade: 200, hex: '#fde68a', name: 'Gold 200' },
      { shade: 300, hex: '#fcd34d', name: 'Gold 300' },
      { shade: 400, hex: '#fbbf24', name: 'Amber 400 (Solar)' },
      { shade: 500, hex: '#f59e0b', name: 'Amber 500 (Pure)' },
      { shade: 600, hex: '#d97706', name: 'Amber 600 (Bronze)' },
      { shade: 700, hex: '#b45309', name: 'Amber 700 (Ocher)' },
    ],
  },
  {
    id: 'orange',
    name: 'Orange & Tangerine',
    shades: [
      { shade: 200, hex: '#fed7aa', name: 'Orange 200' },
      { shade: 300, hex: '#fdba74', name: 'Orange 300' },
      { shade: 400, hex: '#fb923c', name: 'Orange 400 (Coral)' },
      { shade: 500, hex: '#f97316', name: 'Orange 500 (Tangerine)' },
      { shade: 600, hex: '#ea580c', name: 'Orange 600 (Flame)' },
      { shade: 700, hex: '#c2410c', name: 'Orange 700 (Rust)' },
    ],
  },
  {
    id: 'rose',
    name: 'Rose & Crimson',
    shades: [
      { shade: 200, hex: '#fecdd3', name: 'Rose 200' },
      { shade: 300, hex: '#fda4af', name: 'Rose 300' },
      { shade: 400, hex: '#fb7185', name: 'Rose 400 (Vibrant)' },
      { shade: 500, hex: '#f43f5e', name: 'Rose 500 (Crimson)' },
      { shade: 600, hex: '#e11d48', name: 'Rose 600 (Ruby)' },
      { shade: 700, hex: '#be123c', name: 'Rose 700 (Wine)' },
    ],
  },
  {
    id: 'pink',
    name: 'Fuchsia & Pink',
    shades: [
      { shade: 200, hex: '#f5d0fe', name: 'Pink 200' },
      { shade: 300, hex: '#f0abfc', name: 'Pink 300' },
      { shade: 400, hex: '#e879f9', name: 'Pink 400 (Hot Pink)' },
      { shade: 500, hex: '#d946ef', name: 'Pink 500 (Fuchsia)' },
      { shade: 600, hex: '#c026d3', name: 'Pink 600 (Berry)' },
      { shade: 700, hex: '#a21caf', name: 'Pink 700 (Plum)' },
    ],
  },
  {
    id: 'monochrome',
    name: 'Titanium & Platinum',
    shades: [
      { shade: 200, hex: '#ffffff', name: 'Pure White' },
      { shade: 300, hex: '#f1f5f9', name: 'Platinum 200' },
      { shade: 400, hex: '#cbd5e1', name: 'Silver 300' },
      { shade: 500, hex: '#94a3b8', name: 'Steel 400' },
      { shade: 600, hex: '#64748b', name: 'Slate 500' },
      { shade: 700, hex: '#475569', name: 'Carbon 600' },
    ],
  },
];

export const POPULAR_PRESET_SHADES = [
  { name: 'Sky Cyan', hex: '#38bdf8' },
  { name: 'Matrix Green', hex: '#10b981' },
  { name: 'Royal Violet', hex: '#c084fc' },
  { name: 'Solar Amber', hex: '#fbbf24' },
  { name: 'Ruby Crimson', hex: '#fb7185' },
  { name: 'Pure White', hex: '#ffffff' },
  { name: 'Neon Coral', hex: '#fb923c' },
  { name: 'Hot Magenta', hex: '#e879f9' },
];

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    clean = clean.split('').map((c) => c + c).join('');
  }
  const num = parseInt(clean, 16);
  if (isNaN(num) || clean.length !== 6) {
    return { r: 56, g: 189, b: 248 }; // fallback sky cyan
  }
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

export function getContrastColor(hex: string): string {
  const { r, g, b } = hexToRgb(hex);
  // Perceived luminance formula (ITU-R BT.709)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.58 ? '#000000' : '#ffffff';
}

export function hexToRgba(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Adjust shade brightness by percent (-100 to +100).
 */
export function adjustBrightness(hex: string, percent: number): string {
  const { r, g, b } = hexToRgb(hex);
  const factor = percent / 100;
  const adjust = (val: number) => {
    if (factor > 0) {
      return Math.min(255, Math.round(val + (255 - val) * factor));
    } else {
      return Math.max(0, Math.round(val + val * factor));
    }
  };
  const nr = adjust(r).toString(16).padStart(2, '0');
  const ng = adjust(g).toString(16).padStart(2, '0');
  const nb = adjust(b).toString(16).padStart(2, '0');
  return `#${nr}${ng}${nb}`;
}

/**
 * Injects dynamic CSS variables for custom user-selected shades into documentElement.
 */
export function applyThemeAndAccentToDom(themeMode: 'dark' | 'light', accentHex: string) {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  root.setAttribute('data-theme', themeMode);
  if (themeMode === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }

  let cleanHex = accentHex.trim();
  if (!cleanHex.startsWith('#')) {
    cleanHex = '#' + cleanHex;
  }
  if (!/^#[0-9A-Fa-f]{6}$/.test(cleanHex) && !/^#[0-9A-Fa-f]{3}$/.test(cleanHex)) {
    cleanHex = '#38bdf8';
  }

  const contrastText = getContrastColor(cleanHex);
  const containerRgba = hexToRgba(cleanHex, themeMode === 'dark' ? 0.22 : 0.15);
  const glowRgba = hexToRgba(cleanHex, themeMode === 'dark' ? 0.35 : 0.22);

  root.style.setProperty('--accent-primary', cleanHex);
  root.style.setProperty('--accent-primary-text', contrastText);
  root.style.setProperty('--accent-container', cleanHex);
  root.style.setProperty('--accent-container-bg', containerRgba);
  root.style.setProperty('--glow-primary', `0 0 20px ${glowRgba}`);
}
